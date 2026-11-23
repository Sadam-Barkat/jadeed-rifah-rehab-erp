<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountEntry;
use App\Models\Admission;
use App\Models\Bed;
use App\Models\Discharge;
use App\Models\DoctorRound;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\Medicine;
use App\Models\MedicineDispense;
use App\Models\MedicineMovement;
use App\Models\NursingNote;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\FacilityBill;
use App\Models\PettyExpense;
use App\Models\StaffAttendance;
use App\Models\User;
use App\Models\VisitorLog;
use App\Support\SecureUpload;
use App\Support\StaffAttendanceRetention;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        return $this->dashboard($request);
    }

    public function filterMeta(): JsonResponse
    {
        $years = collect([
            Patient::query()->selectRaw('YEAR(created_at) as y')->distinct(),
            Admission::query()->selectRaw('YEAR(admitted_at) as y')->distinct(),
            Payment::query()->selectRaw('YEAR(paid_at) as y')->distinct(),
            VisitorLog::query()->selectRaw('YEAR(check_in_at) as y')->distinct(),
            MedicineDispense::query()->selectRaw('YEAR(dispensed_at) as y')->distinct(),
            InventoryMovement::query()->selectRaw('YEAR(moved_at) as y')->distinct(),
            Invoice::query()->selectRaw('YEAR(created_at) as y')->distinct(),
            User::query()->selectRaw('YEAR(created_at) as y')->distinct(),
        ])
            ->flatMap(fn ($q) => $q->pluck('y'))
            ->filter()
            ->map(fn ($y) => (int) $y)
            ->unique()
            ->sort()
            ->values()
            ->all();

        if ($years === []) {
            $years = [(int) now()->year];
        }

        return response()->json([
            'data' => [
                'years' => $years,
                'months' => range(1, 12),
                'pharmacy_staff' => $this->staffOptionsByRole(['dispenser', 'pharmacist']),
                'inventory_staff' => $this->staffOptionsByRole(['inventory-manager']),
                'finance_staff' => $this->staffOptionsByRole(['finance', 'inventory-manager']),
                'petty_spent_for' => PettyExpense::query()
                    ->where('status', 'posted')
                    ->whereNotNull('spent_for')
                    ->where('spent_for', '!=', '')
                    ->distinct()
                    ->orderBy('spent_for')
                    ->limit(100)
                    ->pluck('spent_for')
                    ->values()
                    ->all(),
                'facility_bill_types' => collect(FacilityBill::TYPES)
                    ->merge(
                        FacilityBill::query()
                            ->whereNotNull('bill_type')
                            ->where('bill_type', '!=', '')
                            ->distinct()
                            ->pluck('bill_type')
                    )
                    ->unique()
                    ->values()
                    ->map(fn ($t) => [
                        'value' => $t,
                        'label' => FacilityBill::typeLabel($t),
                    ])
                    ->all(),
            ],
        ]);
    }

    /** Rule-based low-stock alerts for Admin sidebar badges (not AI). */
    public function stockAlerts(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('role');
        if (($user->role?->slug ?? '') !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $pharmacyLow = Medicine::query()
            ->where('status', 'active')
            ->whereColumn('stock_qty', '<=', 'reorder_level')
            ->count();
        $pharmacyCritical = Medicine::query()
            ->where('status', 'active')
            ->where('stock_qty', '<=', 0)
            ->count();

        $inventoryLow = InventoryItem::query()
            ->where('status', 'active')
            ->tracksReorder()
            ->whereColumn('stock_qty', '<=', 'reorder_level')
            ->count();
        $inventoryCritical = InventoryItem::query()
            ->where('status', 'active')
            ->tracksReorder()
            ->where('stock_qty', '<=', 0)
            ->count();

        return response()->json([
            'data' => [
                'pharmacy' => [
                    'low' => $pharmacyLow,
                    'critical' => $pharmacyCritical,
                    'alert' => $pharmacyLow > 0,
                ],
                'inventory' => [
                    'low' => $inventoryLow,
                    'critical' => $inventoryCritical,
                    'alert' => $inventoryLow > 0,
                ],
            ],
        ]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('role');
        $isAdmin = ($user->role?->slug ?? '') === 'admin';

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'scope' => [
                'nullable',
                'string',
                Rule::in([
                    'admin',
                    'receptionist',
                    'gatekeeper',
                    'doctor',
                    'nurse',
                    'finance',
                    'dispenser',
                    'pharmacist',
                    'inventory-manager',
                    'cook',
                ]),
            ],
            'section' => [
                'nullable',
                'string',
                Rule::in(['overview', 'patients', 'pharmacy', 'inventory', 'inventory-petty', 'inventory-bills', 'finance', 'visitors', 'staff']),
            ],
            'created_by' => ['nullable', 'integer', 'exists:users,id'],
            'spent_for' => ['nullable', 'string', 'max:150'],
            'bill_type' => ['nullable', 'string', 'max:40'],
        ]);

        $to = isset($data['to'])
            ? Carbon::parse($data['to'])->endOfDay()
            : now()->endOfDay();
        $from = isset($data['from'])
            ? Carbon::parse($data['from'])->startOfDay()
            : Carbon::create(2000, 1, 1)->startOfDay();
        $createdBy = isset($data['created_by']) ? (int) $data['created_by'] : null;
        $spentFor = isset($data['spent_for']) ? trim((string) $data['spent_for']) : null;
        if ($spentFor === '') {
            $spentFor = null;
        }
        $billType = isset($data['bill_type']) ? trim((string) $data['bill_type']) : null;
        if ($billType === '') {
            $billType = null;
        }

        if ($from->gt($to)) {
            return response()->json(['message' => 'Invalid date range.'], 422);
        }

        if ($from->diffInDays($to) > 3700) {
            return response()->json(['message' => 'Date range is too large.'], 422);
        }

        $section = $data['section'] ?? null;
        if ($section) {
            if (! $isAdmin) {
                return response()->json(['message' => 'Forbidden dashboard section.'], 403);
            }

            $payload = match ($section) {
                'patients' => $this->adminPatientsSection($from, $to),
                'pharmacy' => $this->adminPharmacySection($from, $to, $createdBy),
                'inventory' => $this->adminInventorySection($from, $to, $createdBy),
                'inventory-petty' => $this->adminInventoryPettySection($from, $to, $createdBy, $spentFor),
                'inventory-bills' => $this->adminInventoryBillsSection($from, $to, $createdBy, $billType),
                'finance' => $this->adminFinanceSection($from, $to),
                'visitors' => $this->adminVisitorsSection($from, $to),
                'staff' => $this->adminStaffSection($from, $to),
                default => $this->adminOverview($from, $to),
            };

            if (($payload['card_mode'] ?? '') !== 'tooltip') {
                $payload = $this->withModalCards($payload);
            } else {
                unset($payload['alerts'], $payload['tables'], $payload['table']);
            }

            return response()->json([
                'data' => array_merge($payload, [
                    'scope' => 'admin',
                    'section' => $section === 'overview' ? 'overview' : $section,
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                    'generated_at' => now()->toDateTimeString(),
                ]),
            ]);
        }

        $requestedScope = $data['scope'] ?? ($isAdmin ? 'admin' : ($user->role?->slug ?? 'admin'));
        $scope = $isAdmin ? $requestedScope : ($user->role?->slug ?? 'receptionist');

        if (! $isAdmin && $scope !== ($user->role?->slug ?? '')) {
            return response()->json(['message' => 'Forbidden dashboard scope.'], 403);
        }

        if ($scope === 'inventory-manager') {
            return response()->json(['message' => 'Inventory Manager dashboard is no longer available.'], 403);
        }

        $payload = match ($scope) {
            'admin' => $this->adminOverview($from, $to),
            'receptionist' => $this->receptionistDashboard($from, $to),
            'gatekeeper' => $this->gatekeeperDashboard($from, $to),
            'doctor' => $this->doctorDashboard($from, $to),
            'nurse' => $this->nurseDashboard($from, $to),
            'finance' => $this->financeDashboard($from, $to),
            'dispenser' => $this->pharmacistDashboard($from, $to),
            'pharmacist' => $this->pharmacistDashboard($from, $to),
            default => $this->adminOverview($from, $to),
        };

        if (($payload['card_mode'] ?? '') !== 'tooltip') {
            $payload = $this->withModalCards($payload);
        } else {
            unset($payload['alerts'], $payload['tables'], $payload['table']);
        }

        return response()->json([
            'data' => array_merge($payload, [
                'scope' => $scope,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'generated_at' => now()->toDateTimeString(),
            ]),
        ]);
    }

    /** Move list tables into KPI card details; drop Notes/alerts. */
    private function withModalCards(array $payload): array
    {
        $payload['card_mode'] = $payload['card_mode'] ?? 'modal';
        unset($payload['alerts']);

        $tables = $payload['tables'] ?? [];
        if (isset($payload['table']) && is_array($payload['table'])) {
            array_unshift($tables, $payload['table']);
        }
        unset($payload['table'], $payload['tables']);

        if ($tables === [] || empty($payload['kpis']) || ! is_array($payload['kpis'])) {
            return $payload;
        }

        foreach ($payload['kpis'] as $i => $kpi) {
            if (! empty($kpi['detail'])) {
                continue;
            }
            $table = $tables[$i] ?? $tables[0] ?? null;
            if (! $table) {
                break;
            }
            $columns = $table['columns'] ?? [];
            $payload['kpis'][$i]['detail'] = [
                'title' => $table['title'] ?? ($kpi['label'] ?? 'Details'),
                'columns' => $columns,
                'filter_column' => $table['filter_column'] ?? (count($columns) ? $columns[count($columns) - 1] : null),
                'rows' => $table['rows'] ?? [],
            ];
        }

        return $payload;
    }

    private function adminOverview(Carbon $from, Carbon $to): array
    {
        $totalBeds = Bed::query()->where('status', '!=', 'discarded')->count();
        $occupiedBeds = Bed::query()->where('status', 'occupied')->count();
        $availableBeds = Bed::query()->where('status', 'available')->count();
        $otherBeds = max(0, $totalBeds - $occupiedBeds - $availableBeds);
        $occupancy = $totalBeds > 0 ? round(($occupiedBeds / $totalBeds) * 100, 1) : 0;
        $totalPatients = Patient::query()->count();
        $admittedPatients = Patient::query()->where('status', 'admitted')->count();
        $registeredPatients = Patient::query()->where('status', 'registered')->count();
        $dischargedPatients = Patient::query()->where('status', 'discharged')->count();
        $collectionInRange = (float) Payment::query()->whereBetween('paid_at', [$from, $to])->sum('amount');
        $paymentCount = Payment::query()->whereBetween('paid_at', [$from, $to])->count();
        $paymentsByMethod = Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('method, COUNT(*) as c, COALESCE(SUM(amount),0) as total')
            ->groupBy('method')
            ->get();
        $invoicePaidTotal = (float) Invoice::query()->sum('paid_amount');
        $invoiceUnpaidBalance = (float) Invoice::query()->whereIn('status', ['unpaid', 'partial'])->sum('balance');
        $invoicePaidCount = Invoice::query()->where('status', 'paid')->count();
        $invoiceUnpaidCount = Invoice::query()
            ->where('status', 'unpaid')
            ->where('paid_amount', '<=', 0)
            ->count();
        $invoiceInstallmentCount = Invoice::query()
            ->where('status', 'unpaid')
            ->where('paid_amount', '>', 0)
            ->where('balance', '>', 0)
            ->count();
        $outstanding = $invoiceUnpaidBalance;
        $openInvoices = $invoiceUnpaidCount + $invoiceInstallmentCount;
        $openInvoiceTotal = (float) Invoice::query()
            ->whereIn('status', ['unpaid', 'partial'])
            ->sum('total_amount');
        // Staff attendance is day-based (not a range sum). Photos clear after 24h.
        StaffAttendanceRetention::maintain();
        $staffDay = $from->isSameDay($to) ? $from->copy() : now();
        $staffDayStr = $staffDay->toDateString();
        $presentToday = StaffAttendance::query()
            ->with(['user.role:id,name'])
            ->whereDate('attendance_date', $staffDayStr)
            ->where('status', 'present')
            ->get();
        $presentCount = $presentToday->count();
        $staffByRole = $presentToday
            ->groupBy(fn (StaffAttendance $a) => $a->user?->role?->name ?: 'No role')
            ->map->count()
            ->sortDesc();
        $lowMedicines = Medicine::query()->where('status', 'active')->whereColumn('stock_qty', '<=', 'reorder_level')->count();
        $lowInventory = InventoryItem::query()
            ->where('status', 'active')
            ->tracksReorder()
            ->whereColumn('stock_qty', '<=', 'reorder_level')
            ->count();
        $visitorsInRange = (int) VisitorLog::query()->whereBetween('check_in_at', [$from, $to])->sum('party_size');
        $visitorsInside = (int) VisitorLog::query()->where('status', 'checked_in')->sum('party_size');
        $visitorsForPatients = (int) VisitorLog::query()
            ->whereBetween('check_in_at', [$from, $to])
            ->whereNotNull('patient_id')
            ->sum('party_size');
        $visitorsWalkIn = max(0, $visitorsInRange - $visitorsForPatients);
        $admissionsInRange = Admission::query()->whereBetween('admitted_at', [$from, $to])->count();
        $activeAdmissions = Admission::query()->where('status', 'active')->count();
        $dischargesInRange = Discharge::query()->whereBetween('discharged_at', [$from, $to])->count();
        $dispensesInRange = MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to])->count();
        $dispenseByCategory = $this->collapseCategoryCounts(
            MedicineDispense::query()
                ->join('medicines', 'medicines.id', '=', 'medicine_dispenses.medicine_id')
                ->whereBetween('medicine_dispenses.dispensed_at', [$from, $to])
                ->where('medicine_dispenses.status', 'dispensed')
                ->selectRaw('medicines.category as category, COUNT(*) as c')
                ->groupBy('medicines.category')
                ->get()
        );
        $lowMedsByCategory = $this->collapseCategoryCounts(
            Medicine::query()
                ->where('status', 'active')
                ->whereColumn('stock_qty', '<=', 'reorder_level')
                ->selectRaw('category, COUNT(*) as c')
                ->groupBy('category')
                ->get()
        );
        $lowInvByCategory = $this->collapseCategoryCounts(
            InventoryItem::query()
                ->where('status', 'active')
                ->tracksReorder()
                ->whereColumn('stock_qty', '<=', 'reorder_level')
                ->selectRaw('category, COUNT(*) as c')
                ->groupBy('category')
                ->get()
        );
        $money = fn (float $n) => 'PKR '.number_format($n, 0);

        $collectionLines = [
            'Total collected: '.$money($collectionInRange),
            "Payments: {$paymentCount}",
        ];
        foreach ($paymentsByMethod as $row) {
            $method = $row->method ?: 'other';
            $collectionLines[] = ucfirst((string) $method).': '.$money((float) $row->total)." ({$row->c})";
        }

        $staffLines = ['Present'];
        if ($staffByRole->isEmpty()) {
            $staffLines[] = 'None: 0';
        } else {
            foreach ($staffByRole as $roleName => $count) {
                $staffLines[] = "{$roleName}: {$count}";
            }
        }

        return [
            'title' => 'Facility overview',
            'card_mode' => 'tooltip',
            'kpis' => [
                [
                    'key' => 'total_patients',
                    'label' => 'All patients',
                    'value' => $totalPatients,
                    'meta' => 'Full registry',
                    'tone' => 'orange',
                    'tooltip_lines' => [
                        'All patient records (any date)',
                        "Registered: {$registeredPatients}",
                        "Admitted now: {$admittedPatients}",
                        "Discharged: {$dischargedPatients}",
                    ],
                ],
                [
                    'key' => 'occupancy',
                    'label' => 'Occupancy',
                    'value' => $occupancy,
                    'suffix' => '%',
                    'meta' => "{$occupiedBeds}/{$totalBeds} beds",
                    'tone' => 'blue',
                    'tooltip_lines' => [
                        "Occupied: {$occupiedBeds}",
                        "Free: {$availableBeds}",
                        "Other: {$otherBeds}",
                        "Total beds: {$totalBeds}",
                    ],
                ],
                [
                    'key' => 'beds',
                    'label' => 'Beds free',
                    'value' => $availableBeds,
                    'meta' => "of {$totalBeds}",
                    'tone' => 'green',
                    'tooltip_lines' => [
                        "Available now: {$availableBeds}",
                        "Occupied: {$occupiedBeds}",
                        "Occupancy: {$occupancy}%",
                    ],
                ],
                [
                    'key' => 'admissions',
                    'label' => 'Admissions',
                    'value' => $admissionsInRange,
                    'meta' => 'In selected period',
                    'tone' => 'blue',
                    'tooltip_lines' => [
                        'Bed admissions in selected period',
                        "Admissions: {$admissionsInRange}",
                        "Active stays now: {$activeAdmissions}",
                        "Discharges in period: {$dischargesInRange}",
                    ],
                ],
                [
                    'key' => 'discharges',
                    'label' => 'Discharges',
                    'value' => $dischargesInRange,
                    'meta' => $this->rangeLabel($from, $to),
                    'tone' => 'purple',
                    'tooltip_lines' => [
                        "Discharges: {$dischargesInRange}",
                        "New admissions: {$admissionsInRange}",
                        'Net change: '.($admissionsInRange - $dischargesInRange),
                    ],
                ],
                [
                    'key' => 'revenue',
                    'label' => 'Collection',
                    'value' => $collectionInRange,
                    'money' => true,
                    'meta' => "{$paymentCount} payment(s)",
                    'tone' => 'green',
                    'tooltip_lines' => $collectionLines,
                ],
                [
                    'key' => 'outstanding',
                    'label' => 'Fees outstanding',
                    'value' => $outstanding,
                    'money' => true,
                    'meta' => "{$openInvoices} open invoice(s)",
                    'tone' => 'red',
                    'tooltip_lines' => [
                        'Still unpaid balance: '.$money($invoiceUnpaidBalance),
                        'Already collected on invoices: '.$money($invoicePaidTotal),
                        "Fully paid invoices: {$invoicePaidCount}",
                        "Unpaid invoices: {$invoiceUnpaidCount}",
                        "Installments in progress: {$invoiceInstallmentCount}",
                    ],
                ],
                [
                    'key' => 'visitors',
                    'label' => 'Visitors inside',
                    'value' => $visitorsInside,
                    'meta' => 'Currently checked in',
                    'tone' => 'orange',
                    'tooltip_lines' => [
                        "Visitors inside: {$visitorsInside}",
                        "Total visitors (period): {$visitorsInRange}",
                        "For patients: {$visitorsForPatients}",
                        "Walk-in: {$visitorsWalkIn}",
                    ],
                ],
                [
                    'key' => 'pharmacy',
                    'label' => 'Dispenses',
                    'value' => $dispensesInRange,
                    'meta' => "Low meds {$lowMedicines}",
                    'tone' => 'blue',
                    'alert' => $lowMedicines > 0,
                    'alert_text' => $lowMedicines > 0
                        ? "Low medicine stock ({$lowMedicines}) — restock in Pharmacy"
                        : null,
                    'tooltip_lines' => $this->categoryTooltipLines(
                        'Dispenses',
                        $dispenseByCategory,
                        fn ($cat) => Medicine::categoryLabel($cat),
                        'Low Stock',
                        $lowMedsByCategory,
                        fn ($cat) => Medicine::categoryLabel($cat),
                    ),
                ],
                [
                    'key' => 'inventory',
                    'label' => 'Low inventory',
                    'value' => $lowInventory,
                    'meta' => 'Needs restock',
                    'tone' => 'red',
                    'alert' => $lowInventory > 0,
                    'alert_text' => $lowInventory > 0
                        ? "Low inventory ({$lowInventory}) — restock items"
                        : null,
                    'tooltip_lines' => $this->categoryTooltipLines(
                        'Low Stock',
                        $lowInvByCategory,
                        fn ($cat) => InventoryItem::categoryLabel($cat),
                    ),
                ],
                [
                    'key' => 'staff',
                    'label' => 'Staff present',
                    'value' => $presentCount,
                    'meta' => $staffDay->isToday() ? 'Today' : ('On '.$staffDay->format('j M Y')),
                    'tone' => 'purple',
                    'tooltip_lines' => $staffLines,
                ],
                [
                    'key' => 'open_invoices',
                    'label' => 'Open invoices',
                    'value' => $openInvoices,
                    'meta' => 'Unpaid invoice count',
                    'tone' => 'orange',
                    'tooltip_lines' => [
                        "Open invoices: {$openInvoices}",
                        "Not started (unpaid): {$invoiceUnpaidCount}",
                        "Installments in progress: {$invoiceInstallmentCount}",
                        'Outstanding balance: '.$money($invoiceUnpaidBalance),
                        'Unpaid invoice total: '.$money($openInvoiceTotal),
                        "Fully paid: {$invoicePaidCount}",
                    ],
                ],
            ],
            'charts' => [
                [
                    'id' => 'admissions',
                    'title' => 'Admissions trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(Admission::query(), 'admitted_at', $from, $to),
                ],
                [
                    'id' => 'collection',
                    'title' => 'Collection trend (PKR)',
                    'type' => 'bar',
                    'series' => $this->sumSeries(Payment::query(), 'paid_at', 'amount', $from, $to),
                ],
                [
                    'id' => 'visitors',
                    'title' => 'Visitors trend',
                    'type' => 'bar',
                    'series' => $this->sumSeries(VisitorLog::query(), 'check_in_at', 'party_size', $from, $to),
                ],
            ],
        ];
    }

    private function adminPatientsSection(Carbon $from, Carbon $to): array
    {
        $totalBeds = Bed::query()->where('status', '!=', 'discarded')->count();
        $availableBeds = Bed::query()->where('status', 'available')->count();
        $totalPatients = Patient::query()->count();
        $admitted = Patient::query()->where('status', 'admitted')->count();
        $registered = Patient::query()->where('status', 'registered')->count();
        $dischargedStatus = Patient::query()->where('status', 'discharged')->count();
        $admissions = Admission::query()->whereBetween('admitted_at', [$from, $to])->count();
        $discharges = Discharge::query()->whereBetween('discharged_at', [$from, $to])->count();

        $patients = Patient::query()
            ->latest('id')
            ->limit(300)
            ->get(['id', 'patient_code', 'first_name', 'last_name', 'phone', 'cnic', 'status', 'created_at']);

        $beds = Bed::query()
            ->with('room:id,name,code')
            ->orderBy('bed_code')
            ->limit(300)
            ->get();

        $admissionRows = Admission::query()
            ->with(['patient:id,first_name,last_name,patient_code', 'bed:id,bed_code'])
            ->whereBetween('admitted_at', [$from, $to])
            ->latest('admitted_at')
            ->limit(150)
            ->get();

        $mapPatient = function (Patient $p) {
            $name = trim(($p->first_name ?? '').' '.($p->last_name ?? ''));

            return [
                $p->patient_code,
                $name !== '' ? $name : '—',
                $p->phone ?: '—',
                $p->cnic ?: '—',
                $p->status,
            ];
        };

        $allPatientRows = $patients->map($mapPatient)->values()->all();
        $registeredRows = $patients->where('status', 'registered')->map($mapPatient)->values()->all();
        $admittedRows = $patients->where('status', 'admitted')->map($mapPatient)->values()->all();
        $dischargedRows = $patients->where('status', 'discharged')->map($mapPatient)->values()->all();
        $occupiedBeds = Bed::query()->where('status', 'occupied')->count();
        $occupancyPct = $totalBeds > 0 ? round(($occupiedBeds / $totalBeds) * 100, 1) : 0;

        $bedRows = $beds->map(fn (Bed $b) => [
            $b->bed_code,
            $b->room?->name ?: ($b->room?->code ?: '—'),
            $b->status,
        ])->values()->all();

        $admissionDetailRows = $admissionRows->map(function (Admission $a) {
            $name = trim(($a->patient?->first_name ?? '').' '.($a->patient?->last_name ?? ''));

            return [
                $a->admission_code ?? ('#'.$a->id),
                $name !== '' ? $name : ($a->patient?->patient_code ?: '—'),
                $a->bed?->bed_code ?: '—',
                $a->status,
                optional($a->admitted_at)->toDateString() ?: '—',
            ];
        })->values()->all();

        $patientDetail = [
            'columns' => ['Code', 'Name', 'Phone', 'CNIC', 'Status'],
            'allow_filter' => false,
            'search_placeholder' => 'Search by name',
        ];

        return [
            'title' => 'Patients & beds overview',
            'card_mode' => 'modal',
            'kpis' => [
                [
                    'key' => 'all_patients',
                    'label' => 'All patients',
                    'value' => $totalPatients,
                    'meta' => "{$admitted} admitted",
                    'tone' => 'blue',
                    'detail' => array_merge($patientDetail, [
                        'title' => 'All patients',
                        'rows' => $allPatientRows,
                    ]),
                ],
                [
                    'key' => 'registered',
                    'label' => 'Registered',
                    'value' => $registered,
                    'meta' => 'Not admitted yet',
                    'tone' => 'orange',
                    'detail' => array_merge($patientDetail, [
                        'title' => 'Registered patients',
                        'rows' => $registeredRows,
                    ]),
                ],
                [
                    'key' => 'admitted',
                    'label' => 'Admitted',
                    'value' => $admitted,
                    'meta' => "of {$totalPatients} patients",
                    'tone' => 'orange',
                    'detail' => array_merge($patientDetail, [
                        'title' => 'Admitted patients',
                        'rows' => $admittedRows,
                    ]),
                ],
                [
                    'key' => 'discharged',
                    'label' => 'Discharged',
                    'value' => $dischargedStatus,
                    'meta' => "of {$totalPatients} patients",
                    'tone' => 'purple',
                    'detail' => array_merge($patientDetail, [
                        'title' => 'Discharged patients',
                        'rows' => $dischargedRows,
                    ]),
                ],
                [
                    'key' => 'beds',
                    'label' => 'Beds',
                    'value' => $totalBeds,
                    'meta' => "{$availableBeds} free · {$occupancyPct}% full",
                    'tone' => 'green',
                    'detail' => [
                        'title' => 'Beds',
                        'columns' => ['Bed', 'Room', 'Status'],
                        'filter_column' => 'Status',
                        'allow_filter' => true,
                        'search_placeholder' => 'Search by bed or room',
                        'rows' => $bedRows,
                    ],
                ],
                [
                    'key' => 'new_admissions',
                    'label' => 'New admissions',
                    'value' => $admissions,
                    'meta' => "{$discharges} discharges",
                    'tone' => 'blue',
                    'detail' => [
                        'title' => 'New admissions',
                        'columns' => ['Code', 'Patient', 'Bed', 'Status', 'Admitted'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search by name',
                        'rows' => $admissionDetailRows,
                    ],
                ],
            ],
            'charts' => [
                [
                    'id' => 'patient-status',
                    'title' => 'Patients by status',
                    'type' => 'bar',
                    'series' => [
                        ['label' => 'Registered', 'value' => $registered],
                        ['label' => 'Admitted', 'value' => $admitted],
                        ['label' => 'Discharged', 'value' => $dischargedStatus],
                    ],
                ],
                $this->admissionsYearCompareChart(),
            ],
        ];
    }

    private function adminPharmacySection(Carbon $from, Carbon $to, ?int $createdBy = null): array
    {
        $medQuery = Medicine::query()->where('status', 'active');
        if ($createdBy) {
            $medQuery->where('created_by', $createdBy);
        }

        $totalMeds = (clone $medQuery)->count();
        $low = (clone $medQuery)->whereColumn('stock_qty', '<=', 'reorder_level')->count();
        $healthy = max(0, $totalMeds - $low);
        $healthyPct = $totalMeds > 0 ? round(($healthy / $totalMeds) * 100) : 100;
        $critical = (clone $medQuery)->where('stock_qty', '<=', 0)->count();

        $dispenseBase = MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to]);
        if ($createdBy) {
            $dispenseBase->where('created_by', $createdBy);
        }
        $dispenses = (clone $dispenseBase)->count();
        $qty = (float) (clone $dispenseBase)->sum('quantity');

        $stockInBase = MedicineMovement::query()
            ->where('type', 'in')
            ->whereBetween('moved_at', [$from, $to]);
        if ($createdBy) {
            $stockInBase->where('created_by', $createdBy);
        }
        $stockIns = (clone $stockInBase)->count();
        $stockInQty = (int) (clone $stockInBase)->sum('quantity');

        $stockRows = (clone $medQuery)
            ->orderBy('name')
            ->limit(200)
            ->get();

        $dispenseRows = MedicineDispense::query()
            ->with([
                'medicine:id,name,medicine_code',
                'patient:id,first_name,last_name,patient_code',
                'creator:id,name',
            ])
            ->whereBetween('dispensed_at', [$from, $to])
            ->when($createdBy, fn ($q) => $q->where('created_by', $createdBy))
            ->latest('dispensed_at')
            ->limit(100)
            ->get();

        $stockInRows = MedicineMovement::query()
            ->with(['medicine:id,name,medicine_code', 'creator:id,name'])
            ->where('type', 'in')
            ->whereBetween('moved_at', [$from, $to])
            ->when($createdBy, fn ($q) => $q->where('created_by', $createdBy))
            ->latest('moved_at')
            ->limit(100)
            ->get();

        $medicineDetailRows = $stockRows->map(function (Medicine $m) {
            $status = (float) $m->stock_qty <= 0
                ? 'Critical'
                : ((float) $m->stock_qty <= (float) $m->reorder_level ? 'Low' : 'Good');

            return [
                $m->medicine_code,
                $m->name,
                trim($m->stock_qty.' '.($m->unit ?: '')),
                (string) $m->reorder_level,
                $status,
            ];
        })->values()->all();

        $healthyDetailRows = array_values(array_filter($medicineDetailRows, fn ($r) => $r[4] === 'Good'));
        $lowDetailRows = array_values(array_filter($medicineDetailRows, fn ($r) => in_array($r[4], ['Low', 'Critical'], true)));
        $criticalDetailRows = array_values(array_filter($medicineDetailRows, fn ($r) => $r[4] === 'Critical'));

        $dispenseDetailRows = $dispenseRows->map(function (MedicineDispense $d) {
            $patient = trim(($d->patient?->first_name ?? '').' '.($d->patient?->last_name ?? ''));

            return [
                $d->dispense_code ?? ('#'.$d->id),
                $d->medicine?->name ?: ($d->medicine?->medicine_code ?: '—'),
                $patient !== '' ? $patient : ($d->patient?->patient_code ?: '—'),
                (string) $d->quantity,
                $d->creator?->name ?: '—',
                optional($d->dispensed_at)->toDateString() ?: '—',
            ];
        })->values()->all();

        $stockInDetailRows = $stockInRows->map(function (MedicineMovement $m) {
            return [
                $m->movement_code ?? ('#'.$m->id),
                $m->medicine?->name ?: ($m->medicine?->medicine_code ?: '—'),
                (string) $m->quantity,
                $m->batch_no ?: '—',
                $m->creator?->name ?: '—',
                optional($m->moved_at)->toDateTimeString() ?: '—',
            ];
        })->values()->all();

        $chartDispense = MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to]);
        $chartStockIn = MedicineMovement::query()
            ->where('type', 'in')
            ->whereBetween('moved_at', [$from, $to]);
        if ($createdBy) {
            $chartDispense->where('created_by', $createdBy);
            $chartStockIn->where('created_by', $createdBy);
        }

        return [
            'title' => 'Pharmacy overview',
            'card_mode' => 'modal',
            'staff_filter' => true,
            'kpis' => [
                [
                    'key' => 'total',
                    'label' => 'Total medications',
                    'value' => $totalMeds,
                    'meta' => 'Active stock',
                    'tone' => 'blue',
                    'detail' => [
                        'title' => 'Medicines',
                        'columns' => ['Code', 'Name', 'Qty', 'Reorder', 'Status'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search by name',
                        'rows' => $medicineDetailRows,
                    ],
                ],
                [
                    'key' => 'healthy',
                    'label' => 'Healthy stock',
                    'value' => $healthy,
                    'meta' => $totalMeds > 0 ? "{$healthyPct}% of active" : 'Above reorder',
                    'tone' => 'green',
                    'detail' => [
                        'title' => 'Healthy stock',
                        'columns' => ['Code', 'Name', 'Qty', 'Reorder', 'Status'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search by name',
                        'rows' => $healthyDetailRows,
                    ],
                ],
                [
                    'key' => 'low',
                    'label' => 'Low stock items',
                    'value' => $low,
                    'meta' => 'At / below reorder',
                    'tone' => 'orange',
                    'alert' => $low > 0,
                    'alert_text' => $low > 0
                        ? "{$low} medicine(s) need restock"
                        : null,
                    'detail' => [
                        'title' => 'Low stock',
                        'columns' => ['Code', 'Name', 'Qty', 'Reorder', 'Status'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search by name',
                        'rows' => $lowDetailRows,
                    ],
                ],
                [
                    'key' => 'critical',
                    'label' => 'Critical (zero)',
                    'value' => $critical,
                    'meta' => 'Out of stock',
                    'tone' => 'red',
                    'alert' => $critical > 0,
                    'alert_text' => $critical > 0
                        ? "{$critical} medicine(s) out of stock"
                        : null,
                    'detail' => [
                        'title' => 'Critical medicines',
                        'columns' => ['Code', 'Name', 'Qty', 'Reorder', 'Status'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search by name',
                        'rows' => $criticalDetailRows,
                    ],
                ],
                [
                    'key' => 'stock_in',
                    'label' => 'Stock in',
                    'value' => $stockIns,
                    'meta' => "Qty {$stockInQty}",
                    'tone' => 'green',
                    'detail' => [
                        'title' => 'Medicine stock in',
                        'columns' => ['Code', 'Medicine', 'Qty', 'Batch', 'Recorded by', 'When'],
                        'allow_filter' => false,
                        'staff_filter_column' => 'Recorded by',
                        'search_placeholder' => 'Search by medicine',
                        'rows' => $stockInDetailRows,
                    ],
                ],
                [
                    'key' => 'dispenses',
                    'label' => 'Dispenses',
                    'value' => $dispenses,
                    'meta' => "Qty {$qty}",
                    'tone' => 'purple',
                    'detail' => [
                        'title' => 'Dispenses in range',
                        'columns' => ['Code', 'Medicine', 'Patient', 'Qty', 'Recorded by', 'Date'],
                        'allow_filter' => false,
                        'staff_filter_column' => 'Recorded by',
                        'search_placeholder' => 'Search by medicine',
                        'rows' => $dispenseDetailRows,
                    ],
                ],
            ],
            'charts' => [
                [
                    'id' => 'dispenses',
                    'title' => 'Dispense trend',
                    'type' => 'bar',
                    'series' => $this->countSeries($chartDispense, 'dispensed_at', $from, $to),
                ],
                [
                    'id' => 'stock-in',
                    'title' => 'Stock in trend',
                    'type' => 'bar',
                    'series' => $this->sumSeries($chartStockIn, 'moved_at', 'quantity', $from, $to),
                ],
            ],
        ];
    }

    private function adminInventorySection(Carbon $from, Carbon $to, ?int $createdBy = null): array
    {
        $moveBase = InventoryMovement::query()->whereBetween('moved_at', [$from, $to]);
        if ($createdBy) {
            $moveBase->where('created_by', $createdBy);
        }

        $movesIn = (clone $moveBase)->where('type', 'in')->count();
        $movesOut = (clone $moveBase)->where('type', 'out')->count();
        $departmentUsage = (clone $moveBase)
            ->where('type', 'out')
            ->whereNotNull('department')
            ->where('department', '!=', '')
            ->selectRaw('department, COUNT(*) as entries')
            ->groupBy('department')
            ->orderByDesc('entries')
            ->orderBy('department')
            ->get();
        $topDepartment = $departmentUsage->first();

        $departmentUsageDetail = [
            'title' => 'Stock use by department',
            'columns' => ['Department', 'Stock-out entries'],
            'allow_filter' => false,
            'search_placeholder' => 'Search departments',
            'rows' => $departmentUsage->map(fn ($row) => [
                ucwords(str_replace('_', ' ', $row->department)),
                (int) $row->entries,
            ])->values()->all(),
        ];

        $itemQuery = InventoryItem::query()->where('status', 'active');
        if ($createdBy) {
            $itemQuery->where('created_by', $createdBy);
        }
        $reorderQuery = (clone $itemQuery)->tracksReorder();
        $low = (clone $reorderQuery)->whereColumn('stock_qty', '<=', 'reorder_level')->count();
        $critical = (clone $reorderQuery)->where('stock_qty', '<=', 0)->count();
        $activeItems = (clone $itemQuery)->count();

        $items = (clone $itemQuery)
            ->orderBy('name')
            ->limit(200)
            ->get();

        $moveRows = InventoryMovement::query()
            ->with(['item:id,name,item_code,unit,unit_cost', 'creator:id,name'])
            ->whereBetween('moved_at', [$from, $to])
            ->when($createdBy, fn ($q) => $q->where('created_by', $createdBy))
            ->latest('moved_at')
            ->limit(300)
            ->get();

        $itemRows = $items->map(function (InventoryItem $i) {
            return [
                $i->item_code,
                $i->name,
                $i->category ?: '—',
                $this->qtyLabel((float) $i->stock_qty, $i->unit),
                (string) $i->reorder_level,
                $i->stockStatusLabel(),
            ];
        })->values()->all();

        $inDetail = $this->inventoryMovementDetail(
            $moveRows->where('type', 'in')->values(),
            'Stock in',
            false,
            true
        );
        $outDetail = $this->inventoryMovementDetail(
            $moveRows->where('type', 'out')->values(),
            'Stock out',
            false
        );
        $outTrend = InventoryMovement::query()->where('type', 'out')->whereBetween('moved_at', [$from, $to]);
        $inTrend = InventoryMovement::query()->where('type', 'in')->whereBetween('moved_at', [$from, $to]);
        if ($createdBy) {
            $outTrend->where('created_by', $createdBy);
            $inTrend->where('created_by', $createdBy);
        }

        return [
            'title' => 'Inventory overview',
            'card_mode' => 'modal',
            'staff_filter' => true,
            'kpis' => [
                [
                    'key' => 'items',
                    'label' => 'Active items',
                    'value' => $activeItems,
                    'meta' => "Low {$low}",
                    'tone' => 'blue',
                    'detail' => [
                        'title' => 'Inventory items',
                        'columns' => ['Code', 'Name', 'Category', 'Qty', 'Reorder', 'Status'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search by name',
                        'rows' => $itemRows,
                    ],
                ],
                [
                    'key' => 'in',
                    'label' => 'Stock in',
                    'value' => $movesIn,
                    'meta' => 'Entries',
                    'tone' => 'green',
                    'detail' => $inDetail,
                ],
                [
                    'key' => 'out',
                    'label' => 'Stock out',
                    'value' => $movesOut,
                    'meta' => 'Entries',
                    'tone' => 'orange',
                    'detail' => $outDetail,
                ],
                [
                    'key' => 'top-department',
                    'label' => 'Top consuming department',
                    'value' => $topDepartment
                        ? ucwords(str_replace('_', ' ', $topDepartment->department))
                        : '—',
                    'meta' => $topDepartment
                        ? ((int) $topDepartment->entries).' stock-out entries'
                        : 'No stock-out entries',
                    'tone' => 'blue',
                    'detail' => $departmentUsageDetail,
                ],
                [
                    'key' => 'critical',
                    'label' => 'Critical',
                    'value' => $critical,
                    'meta' => 'Zero stock',
                    'tone' => 'red',
                    'alert' => $critical > 0,
                    'alert_text' => $critical > 0
                        ? "{$critical} inventory item(s) out of stock"
                        : null,
                    'detail' => [
                        'title' => 'Critical items',
                        'columns' => ['Code', 'Name', 'Category', 'Qty', 'Reorder', 'Status'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search by name',
                        'rows' => array_values(array_filter($itemRows, fn ($r) => $r[5] === 'Out of stock')),
                    ],
                ],
                [
                    'key' => 'low',
                    'label' => 'Low items',
                    'value' => $low,
                    'meta' => 'Needs restock',
                    'tone' => 'red',
                    'alert' => $low > 0,
                    'alert_text' => $low > 0
                        ? "{$low} inventory item(s) need restock"
                        : null,
                    'detail' => [
                        'title' => 'Low / critical stock',
                        'columns' => ['Code', 'Name', 'Category', 'Qty', 'Reorder', 'Status'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search by name',
                        'rows' => array_values(array_filter($itemRows, fn ($r) => in_array($r[5], ['Low stock', 'Out of stock'], true))),
                    ],
                ],
            ],
            'charts' => [
                [
                    'id' => 'out',
                    'title' => 'Stock OUT trend',
                    'type' => 'bar',
                    'series' => $this->countSeries($outTrend, 'moved_at', $from, $to),
                ],
                [
                    'id' => 'in',
                    'title' => 'Stock IN trend',
                    'type' => 'bar',
                    'series' => $this->countSeries($inTrend, 'moved_at', $from, $to),
                ],
            ],
        ];
    }

    private function adminVisitorsSection(Carbon $from, Carbon $to): array
    {
        $base = VisitorLog::query()->whereBetween('check_in_at', [$from, $to]);

        $totalHeads = (int) (clone $base)->sum('party_size');
        $forPatients = (int) (clone $base)->whereNotNull('patient_id')->sum('party_size');
        $walkIn = (int) (clone $base)->whereNull('patient_id')->sum('party_size');

        $insideRowsQuery = VisitorLog::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->where('status', 'checked_in')
            ->latest('check_in_at')
            ->limit(100)
            ->get();
        $insideHeads = (int) $insideRowsQuery->sum(fn (VisitorLog $v) => (int) ($v->party_size ?? 1));

        $rows = VisitorLog::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->whereBetween('check_in_at', [$from, $to])
            ->latest('check_in_at')
            ->limit(200)
            ->get();

        $mapRow = function (VisitorLog $v) {
            $patient = trim(($v->patient?->first_name ?? '').' '.($v->patient?->last_name ?? ''));

            return [
                $v->visit_code ?? ('#'.$v->id),
                $v->visitor_name,
                $v->cnic ?: '—',
                (string) ($v->party_size ?? 1),
                $patient !== '' ? $patient : ($v->patient?->patient_code ?: '—'),
                optional($v->check_in_at)->format('Y-m-d H:i') ?: '—',
            ];
        };

        $allRows = $rows->map($mapRow)->values()->all();
        $patientRows = $rows->whereNotNull('patient_id')->map($mapRow)->values()->all();
        $walkInRows = $rows->whereNull('patient_id')->map($mapRow)->values()->all();
        $insideRows = $insideRowsQuery->map($mapRow)->values()->all();

        $listCols = ['Code', 'Visitor', 'CNIC', 'Visitors', 'Patient', 'Check-in'];

        return [
            'title' => 'Visitors overview',
            'card_mode' => 'modal',
            'kpis' => [
                [
                    'key' => 'total',
                    'label' => 'Total visitors',
                    'value' => $totalHeads,
                    'meta' => $this->rangeLabel($from, $to),
                    'tone' => 'blue',
                    'detail' => [
                        'title' => 'Visitor logs',
                        'columns' => $listCols,
                        'allow_filter' => false,
                        'search_placeholder' => 'Search visitor / patient',
                        'rows' => $allRows,
                    ],
                ],
                [
                    'key' => 'for_patients',
                    'label' => 'For patients',
                    'value' => $forPatients,
                    'meta' => 'Linked to patient',
                    'tone' => 'green',
                    'detail' => [
                        'title' => 'Patient visits',
                        'columns' => $listCols,
                        'allow_filter' => false,
                        'search_placeholder' => 'Search visitor / patient',
                        'rows' => $patientRows,
                    ],
                ],
                [
                    'key' => 'walk_in',
                    'label' => 'Walk-in',
                    'value' => $walkIn,
                    'meta' => 'No patient linked',
                    'tone' => 'orange',
                    'detail' => [
                        'title' => 'Walk-in visitors',
                        'columns' => $listCols,
                        'allow_filter' => false,
                        'search_placeholder' => 'Search visitor',
                        'rows' => $walkInRows,
                    ],
                ],
                [
                    'key' => 'inside',
                    'label' => 'Inside now',
                    'value' => $insideHeads,
                    'meta' => 'Still checked in',
                    'tone' => 'purple',
                    'detail' => [
                        'title' => 'Currently inside',
                        'columns' => $listCols,
                        'allow_filter' => false,
                        'search_placeholder' => 'Search visitor / patient',
                        'rows' => $insideRows,
                    ],
                ],
            ],
            'charts' => [
                [
                    'id' => 'visitors-heads',
                    'title' => 'Visitors trend',
                    'type' => 'bar',
                    'series' => $this->sumSeries(VisitorLog::query(), 'check_in_at', 'party_size', $from, $to),
                ],
                [
                    'id' => 'visit-type',
                    'title' => 'Visit type',
                    'type' => 'bar',
                    'series' => [
                        ['label' => 'For patients', 'value' => $forPatients],
                        ['label' => 'Walk-in', 'value' => $walkIn],
                    ],
                ],
            ],
        ];
    }

    private function adminFinanceSection(Carbon $from, Carbon $to): array
    {
        $collection = (float) Payment::query()->whereBetween('paid_at', [$from, $to])->sum('amount');
        $paymentCount = Payment::query()->whereBetween('paid_at', [$from, $to])->count();
        $outstanding = (float) Invoice::query()->whereIn('status', ['unpaid', 'partial'])->sum('balance');
        $open = Invoice::query()->whereIn('status', ['unpaid', 'partial'])->count();

        // Hospital spending (patient fee is income; hospital runs pharmacy/inventory/petty).
        $pharmacyExpense = (float) MedicineMovement::query()
            ->where('type', 'in')
            ->whereBetween('moved_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0) as total')
            ->value('total');

        $inventoryExpense = (float) InventoryMovement::query()
            ->where('inventory_movements.type', 'in')
            ->whereBetween('inventory_movements.moved_at', [$from, $to])
            ->leftJoin('inventory_items', 'inventory_items.id', '=', 'inventory_movements.inventory_item_id')
            ->selectRaw('COALESCE(SUM(inventory_movements.quantity * COALESCE(inventory_movements.unit_cost, inventory_items.unit_cost, 0)), 0) as total')
            ->value('total');

        $pettyExpense = (float) PettyExpense::query()
            ->where('status', 'posted')
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $facilityExpense = (float) FacilityBill::query()
            ->where('status', 'posted')
            ->whereBetween('bill_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $pharmacyExpense = round($pharmacyExpense, 2);
        $inventoryExpense = round($inventoryExpense, 2);
        $pettyExpense = round($pettyExpense, 2);
        $facilityExpense = round($facilityExpense, 2);
        $expense = round($pharmacyExpense + $inventoryExpense + $pettyExpense + $facilityExpense, 2);
        $profit = round($collection - $expense, 2);

        $openInvoices = Invoice::query()
            ->with('patient:id,first_name,last_name')
            ->whereIn('status', ['unpaid', 'partial'])
            ->latest('id')
            ->limit(200)
            ->get();

        $payments = Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->latest('paid_at')
            ->limit(100)
            ->get();

        $outstandingRows = $openInvoices->map(function (Invoice $inv) {
            $patientName = trim(($inv->patient?->first_name ?? '').' '.($inv->patient?->last_name ?? ''));

            return [
                $inv->invoice_code,
                $patientName !== '' ? $patientName : '—',
                number_format((float) ($inv->total_amount ?? $inv->amount ?? 0), 0),
                number_format((float) $inv->balance, 0),
                $inv->status,
            ];
        })->values()->all();

        $paymentRows = $payments->map(fn (Payment $p) => [
            $p->payment_code ?? ('#'.$p->id),
            number_format((float) $p->amount, 0),
            $p->method ?? '—',
            optional($p->paid_at)->toDateString() ?: '—',
        ])->values()->all();

        $expenseBreakdownRows = [
            ['Pharmacy (medicine stock in)', number_format($pharmacyExpense, 0)],
            ['Inventory (stock in)', number_format($inventoryExpense, 0)],
            ['Petty expenses', number_format($pettyExpense, 0)],
            ['Facility bills', number_format($facilityExpense, 0)],
        ];

        $profitRows = [
            ['Collection', number_format($collection, 0)],
            ['Pharmacy expense', number_format($pharmacyExpense, 0)],
            ['Inventory expense', number_format($inventoryExpense, 0)],
            ['Petty expenses', number_format($pettyExpense, 0)],
            ['Facility bills', number_format($facilityExpense, 0)],
            ['Total expenses', number_format($expense, 0)],
            ['Net profit', number_format($profit, 0)],
        ];

        return [
            'title' => 'Billing & finance overview',
            'card_mode' => 'modal',
            'kpis' => [
                [
                    'key' => 'revenue',
                    'label' => 'Collection',
                    'value' => $collection,
                    'money' => true,
                    'meta' => "{$paymentCount} payment(s)",
                    'tone' => 'green',
                    'detail' => [
                        'title' => 'Payments in range',
                        'columns' => ['Code', 'Amount', 'Method', 'Paid at'],
                        'filter_column' => 'Method',
                        'rows' => $paymentRows,
                    ],
                ],
                [
                    'key' => 'outstanding',
                    'label' => 'Outstanding',
                    'value' => $outstanding,
                    'money' => true,
                    'meta' => "{$open} invoice(s)",
                    'tone' => 'orange',
                    'detail' => [
                        'title' => 'Outstanding invoices',
                        'columns' => ['Invoice', 'Patient', 'Total', 'Balance', 'Status'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search invoice / patient',
                        'rows' => $outstandingRows,
                    ],
                ],
                [
                    'key' => 'expense',
                    'label' => 'Expenses',
                    'value' => $expense,
                    'money' => true,
                    'meta' => 'Ops + facility',
                    'tone' => 'purple',
                    'detail' => [
                        'title' => 'Expense sources',
                        'columns' => ['Source', 'Total PKR'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search',
                        'rows' => $expenseBreakdownRows,
                    ],
                ],
                [
                    'key' => 'profit',
                    'label' => 'Net profit',
                    'value' => $profit,
                    'money' => true,
                    'meta' => 'Collection − expenses',
                    'tone' => $profit >= 0 ? 'green' : 'red',
                    'detail' => [
                        'title' => 'Net profit',
                        'columns' => ['Item', 'Amount'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search',
                        'rows' => $profitRows,
                    ],
                ],
            ],
            'charts' => [
                [
                    'id' => 'collection',
                    'title' => 'Collection trend (PKR)',
                    'type' => 'bar',
                    'series' => $this->sumSeries(Payment::query(), 'paid_at', 'amount', $from, $to),
                ],
                [
                    'id' => 'net-profit',
                    'title' => 'Net profit trend (PKR)',
                    'type' => 'bar',
                    'series' => $this->financeNetProfitSeries($from, $to),
                ],
            ],
        ];
    }

    private function adminStaffSection(Carbon $from, Carbon $to): array
    {
        $active = User::query()->where('is_active', true)->count();
        $total = User::query()->count();
        StaffAttendanceRetention::maintain();
        $staffDay = $from->isSameDay($to) ? $from->copy() : now();
        $staffDayStr = $staffDay->toDateString();
        $presentRows = StaffAttendance::query()
            ->with(['user.role:id,name', 'checker:id,name'])
            ->whereDate('attendance_date', $staffDayStr)
            ->where('status', 'present')
            ->latest('check_in_at')
            ->get();
        $presentGallery = $presentRows->map(function (StaffAttendance $a) {
            return [
                'id' => $a->id,
                'name' => $a->user?->name ?: '—',
                'role' => $a->user?->role?->name ?: '—',
                'staff_code' => $a->user?->staff_code ?: '—',
                'phone' => $a->user?->phone ?: '—',
                'email' => $a->user?->email ?: '—',
                'check_in_at' => optional($a->check_in_at)->format('h:i A') ?: '—',
                'checked_in_by' => $a->checker?->name ?: '—',
                'photo_url' => SecureUpload::url($a->photo_path),
            ];
        })->values()->all();
        $staff = User::query()
            ->with('role:id,name,slug')
            ->orderBy('name')
            ->limit(300)
            ->get();

        $roleOrder = [
            'receptionist',
            'gatekeeper',
            'doctor',
            'nurse',
            'finance',
            'dispenser',
            'inventory-manager',
            'cook',
        ];
        $roleTones = [
            'receptionist' => 'blue',
            'gatekeeper' => 'orange',
            'doctor' => 'green',
            'nurse' => 'purple',
            'finance' => 'green',
            'dispenser' => 'orange',
            'inventory-manager' => 'red',
            'cook' => 'orange',
        ];
        $roleLabels = [
            'receptionist' => 'Receptionists',
            'gatekeeper' => 'Gatekeepers',
            'doctor' => 'Doctors',
            'nurse' => 'Nurses',
            'finance' => 'Finance staff',
            'dispenser' => 'Dispensers',
            'inventory-manager' => 'Inventory managers',
            'cook' => 'Cooks',
        ];

        $roles = \App\Models\Role::query()
            ->whereIn('slug', $roleOrder)
            ->get(['id', 'name', 'slug'])
            ->sortBy(fn ($r) => array_search($r->slug, $roleOrder, true))
            ->values();

        $roleCounts = User::query()
            ->selectRaw('role_id, COUNT(*) as c')
            ->groupBy('role_id')
            ->pluck('c', 'role_id');
        $roleActiveCounts = User::query()
            ->selectRaw('role_id, COUNT(*) as c')
            ->where('is_active', true)
            ->groupBy('role_id')
            ->pluck('c', 'role_id');

        $staffRows = $staff->map(fn (User $u) => [
            $u->name,
            $u->email,
            $u->role?->name ?? '—',
            $u->staff_code ?: '—',
            $u->is_active ? 'Active' : 'Inactive',
        ])->values()->all();

        // Exclude admin accounts from role list cards / role chart
        $staffRowsNoAdmin = array_values(array_filter(
            $staffRows,
            fn ($r) => strcasecmp((string) $r[2], 'Admin') !== 0
        ));

        $kpis = [
            [
                'key' => 'total',
                'label' => 'Total staff',
                'value' => $total,
                'meta' => "Active {$active}",
                'tone' => 'blue',
                'detail' => [
                    'title' => 'All staff',
                    'columns' => ['Name', 'Email', 'Role', 'Code', 'Status'],
                    'allow_filter' => false,
                    'search_placeholder' => 'Search staff',
                    'rows' => $staffRows,
                ],
            ],
        ];

        foreach ($roles as $role) {
            $count = (int) ($roleCounts[$role->id] ?? 0);
            $activeCount = (int) ($roleActiveCounts[$role->id] ?? 0);
            $slug = $role->slug;
            $roleName = $role->name;
            $roleRows = array_values(array_filter($staffRowsNoAdmin, fn ($r) => $r[2] === $roleName));

            $kpis[] = [
                'key' => 'role_'.$slug,
                'label' => $roleLabels[$slug] ?? $roleName,
                'value' => $count,
                'meta' => "Active {$activeCount}",
                'tone' => $roleTones[$slug] ?? 'blue',
                'detail' => [
                    'title' => ($roleLabels[$slug] ?? $roleName),
                    'columns' => ['Name', 'Email', 'Role', 'Code', 'Status'],
                    'filter_column' => 'Status',
                    'rows' => $roleRows,
                ],
            ];
        }

        return [
            'title' => 'Staff overview',
            'card_mode' => 'modal',
            'kpis' => $kpis,
            'charts' => [],
            'present_gallery' => [
                'title' => $staffDay->isToday() ? 'Present today' : ('Present · '.$staffDay->format('j M Y')),
                'items' => $presentGallery,
            ],
        ];
    }

    private function receptionistDashboard(Carbon $from, Carbon $to): array
    {
        $registered = Patient::query()->whereBetween('created_at', [$from, $to])->count();
        $admissions = Admission::query()->whereBetween('admitted_at', [$from, $to])->count();
        $active = Admission::query()->where('status', 'active')->count();
        $availableBeds = Bed::query()->where('status', 'available')->count();
        $occupiedBeds = Bed::query()->where('status', 'occupied')->count();
        $totalBeds = Bed::query()->where('status', '!=', 'discarded')->count();
        $totalPatients = Patient::query()->count();
        $admittedPatients = Patient::query()->where('status', 'admitted')->count();

        $patients = Patient::query()
            ->latest('id')
            ->limit(150)
            ->get(['patient_code', 'first_name', 'last_name', 'phone', 'cnic', 'status', 'created_at']);

        $admissionRows = Admission::query()
            ->with(['patient:id,first_name,last_name,patient_code', 'bed:id,bed_code'])
            ->whereBetween('admitted_at', [$from, $to])
            ->latest('admitted_at')
            ->limit(100)
            ->get();

        $beds = Bed::query()
            ->with('room:id,name,code')
            ->orderBy('bed_code')
            ->limit(200)
            ->get();

        return [
            'title' => 'Reception dashboard',
            'kpis' => [
                [
                    'key' => 'requests',
                    'label' => 'Pending approval',
                    'value' => Patient::query()->where('status', 'registered')->count(),
                    'meta' => 'Waiting for admin',
                    'tone' => 'orange',
                ],
                [
                    'key' => 'assign',
                    'label' => 'Ready for bed',
                    'value' => Patient::query()->where('status', 'approved')->count(),
                    'meta' => 'Approved — assign bed',
                    'tone' => 'blue',
                ],
                [
                    'key' => 'admitted',
                    'label' => 'Admitted',
                    'value' => $admittedPatients,
                    'meta' => "{$availableBeds} beds free",
                    'tone' => 'green',
                ],
            ],
            'charts' => [
                [
                    'id' => 'registrations',
                    'title' => 'Registrations trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(Patient::query(), 'created_at', $from, $to),
                ],
                [
                    'id' => 'admissions',
                    'title' => 'Admissions trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(Admission::query(), 'admitted_at', $from, $to),
                ],
            ],
            'tables' => [
                [
                    'title' => 'Patients',
                    'total' => $patients->count(),
                    'columns' => ['Code', 'Name', 'Phone', 'CNIC', 'Status'],
                    'rows' => $patients->map(fn (Patient $p) => [
                        $p->patient_code,
                        trim(($p->first_name ?? '').' '.($p->last_name ?? '')) ?: '—',
                        $p->phone ?: '—',
                        $p->cnic ?: '—',
                        $p->status,
                    ])->values()->all(),
                ],
                [
                    'title' => 'Admissions in range',
                    'total' => $admissionRows->count(),
                    'columns' => ['Code', 'Patient', 'Bed', 'Status', 'Admitted'],
                    'rows' => $admissionRows->map(function (Admission $a) {
                        $name = trim(($a->patient?->first_name ?? '').' '.($a->patient?->last_name ?? ''));

                        return [
                            $a->admission_code ?? ('#'.$a->id),
                            $name !== '' ? $name : ($a->patient?->patient_code ?: '—'),
                            $a->bed?->bed_code ?: '—',
                            $a->status,
                            optional($a->admitted_at)->toDateString() ?: '—',
                        ];
                    })->values()->all(),
                ],
                [
                    'title' => 'Beds',
                    'total' => $beds->count(),
                    'columns' => ['Bed', 'Room', 'Status'],
                    'rows' => $beds->map(fn (Bed $b) => [
                        $b->bed_code,
                        $b->room?->name ?: ($b->room?->code ?: '—'),
                        $b->status,
                    ])->values()->all(),
                ],
            ],
            'links' => [],
            'alerts' => $availableBeds === 0
                ? [['title' => 'No beds free', 'detail' => 'All beds are occupied', 'level' => 'warning']]
                : [['title' => 'Reception ready', 'detail' => "{$availableBeds} bed(s) available", 'level' => 'success']],
        ];
    }

    private function gatekeeperDashboard(Carbon $from, Carbon $to): array
    {
        $totalHeads = (int) VisitorLog::query()->whereBetween('check_in_at', [$from, $to])->sum('party_size');
        $forPatients = (int) VisitorLog::query()
            ->whereBetween('check_in_at', [$from, $to])
            ->whereNotNull('patient_id')
            ->sum('party_size');
        $walkIn = max(0, $totalHeads - $forPatients);
        $inside = VisitorLog::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->where('status', 'checked_in')
            ->latest('check_in_at')
            ->limit(100)
            ->get();
        $insideHeads = (int) $inside->sum(fn (VisitorLog $v) => (int) ($v->party_size ?? 1));

        $rows = VisitorLog::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->whereBetween('check_in_at', [$from, $to])
            ->latest('check_in_at')
            ->limit(150)
            ->get();

        return [
            'title' => 'Gate dashboard',
            'kpis' => [
                ['key' => 'visitors', 'label' => 'Total visitors', 'value' => $totalHeads, 'meta' => $this->rangeLabel($from, $to), 'tone' => 'blue'],
                ['key' => 'for_patients', 'label' => 'For patients', 'value' => $forPatients, 'meta' => 'Linked to patient', 'tone' => 'green'],
                ['key' => 'walk_in', 'label' => 'Walk-in', 'value' => $walkIn, 'meta' => 'No patient linked', 'tone' => 'orange'],
                ['key' => 'checked_in', 'label' => 'Inside now', 'value' => $insideHeads, 'meta' => 'Still checked in', 'tone' => 'purple'],
            ],
            'charts' => [
                [
                    'id' => 'visitors',
                    'title' => 'Visitors trend',
                    'type' => 'bar',
                    'series' => $this->sumSeries(VisitorLog::query(), 'check_in_at', 'party_size', $from, $to),
                ],
                [
                    'id' => 'visit-type',
                    'title' => 'Visit type',
                    'type' => 'bar',
                    'series' => [
                        ['label' => 'For patients', 'value' => $forPatients],
                        ['label' => 'Walk-in', 'value' => $walkIn],
                    ],
                ],
            ],
            'tables' => [
                [
                    'title' => 'Currently inside',
                    'total' => $insideHeads,
                    'columns' => ['Visitor', 'Patient', 'Visitors', 'Check-in'],
                    'rows' => $inside->map(function (VisitorLog $v) {
                        $patient = trim(($v->patient?->first_name ?? '').' '.($v->patient?->last_name ?? ''));

                        return [
                            $v->visitor_name,
                            $patient !== '' ? $patient : ($v->patient?->patient_code ?: '—'),
                            (string) ($v->party_size ?? 1),
                            optional($v->check_in_at)->toDateTimeString() ?: '—',
                        ];
                    })->values()->all(),
                ],
                [
                    'title' => 'Visitor logs in range',
                    'total' => $rows->count(),
                    'columns' => ['Visitor', 'Patient', 'Party', 'Status', 'Check-in'],
                    'rows' => $rows->map(function (VisitorLog $v) {
                        $patient = trim(($v->patient?->first_name ?? '').' '.($v->patient?->last_name ?? ''));

                        return [
                            $v->visitor_name,
                            $patient !== '' ? $patient : ($v->patient?->patient_code ?: '—'),
                            (string) ($v->party_size ?? 1),
                            $v->status,
                            optional($v->check_in_at)->toDateString() ?: '—',
                        ];
                    })->values()->all(),
                ],
            ],
            'links' => [
                ['to' => '/app/visitors', 'label' => 'Log visitor'],
            ],
            'alerts' => [['title' => 'Gate desk', 'detail' => "{$insideHeads} visitor(s) still inside", 'level' => 'info']],
        ];
    }

    private function doctorDashboard(Carbon $from, Carbon $to): array
    {
        $rounds = DoctorRound::query()->whereBetween('round_at', [$from, $to])->count();
        $discharges = Discharge::query()->whereBetween('discharged_at', [$from, $to])->count();
        $admitted = Patient::query()->where('status', 'admitted')->count();
        $notes = NursingNote::query()->whereBetween('recorded_at', [$from, $to])->count();
        $dispenses = MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to])->count();

        $patients = Patient::query()
            ->where('status', 'admitted')
            ->latest('id')
            ->limit(150)
            ->get(['patient_code', 'first_name', 'last_name', 'phone', 'status']);

        $roundRows = DoctorRound::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->whereBetween('round_at', [$from, $to])
            ->latest('round_at')
            ->limit(100)
            ->get();

        $dischargeRows = Discharge::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->whereBetween('discharged_at', [$from, $to])
            ->latest('discharged_at')
            ->limit(100)
            ->get();

        return [
            'title' => 'Doctor dashboard',
            'kpis' => [
                ['key' => 'patients', 'label' => 'Active patients', 'value' => $admitted, 'meta' => 'Admitted now', 'tone' => 'orange'],
                ['key' => 'rounds', 'label' => 'Rounds', 'value' => $rounds, 'meta' => $this->rangeLabel($from, $to), 'tone' => 'blue'],
                ['key' => 'notes', 'label' => 'Nursing notes', 'value' => $notes, 'meta' => "Dispenses {$dispenses}", 'tone' => 'green'],
                ['key' => 'discharges', 'label' => 'Discharges', 'value' => $discharges, 'meta' => $this->rangeLabel($from, $to), 'tone' => 'purple'],
            ],
            'charts' => [
                [
                    'id' => 'rounds',
                    'title' => 'Rounds trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(DoctorRound::query(), 'round_at', $from, $to),
                ],
                [
                    'id' => 'discharges',
                    'title' => 'Discharges trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(Discharge::query(), 'discharged_at', $from, $to),
                ],
            ],
            'tables' => [
                [
                    'title' => 'Admitted patients',
                    'total' => $patients->count(),
                    'columns' => ['Code', 'Name', 'Phone', 'Status'],
                    'rows' => $patients->map(fn (Patient $p) => [
                        $p->patient_code,
                        trim(($p->first_name ?? '').' '.($p->last_name ?? '')) ?: '—',
                        $p->phone ?: '—',
                        $p->status,
                    ])->values()->all(),
                ],
                [
                    'title' => 'Rounds in range',
                    'total' => $roundRows->count(),
                    'columns' => ['Code', 'Patient', 'Type', 'Status', 'Date'],
                    'rows' => $roundRows->map(function (DoctorRound $r) {
                        $name = trim(($r->patient?->first_name ?? '').' '.($r->patient?->last_name ?? ''));

                        return [
                            $r->round_code ?? ('#'.$r->id),
                            $name !== '' ? $name : ($r->patient?->patient_code ?: '—'),
                            $r->round_type ?: '—',
                            $r->status ?: '—',
                            optional($r->round_at)->toDateString() ?: '—',
                        ];
                    })->values()->all(),
                ],
                [
                    'title' => 'Discharges in range',
                    'total' => $dischargeRows->count(),
                    'columns' => ['Patient', 'Date', 'Status'],
                    'rows' => $dischargeRows->map(function (Discharge $d) {
                        $name = trim(($d->patient?->first_name ?? '').' '.($d->patient?->last_name ?? ''));

                        return [
                            $name !== '' ? $name : ($d->patient?->patient_code ?: '—'),
                            optional($d->discharged_at)->toDateString() ?: '—',
                            $d->status ?: '—',
                        ];
                    })->values()->all(),
                ],
            ],
            'links' => [
                ['to' => '/app/patients', 'label' => 'Patients'],
                ['to' => '/app/doctors', 'label' => 'Rounds'],
                ['to' => '/app/medical-records', 'label' => 'Medical records'],
                ['to' => '/app/treatment', 'label' => 'Treatment'],
                ['to' => '/app/discharge', 'label' => 'Discharge'],
                ['to' => '/app/nursing', 'label' => 'Nursing'],
                ['to' => '/app/pharmacy', 'label' => 'Pharmacy'],
            ],
            'alerts' => [['title' => 'Clinical load', 'detail' => "{$admitted} admitted patient(s)", 'level' => 'info']],
        ];
    }

    private function nurseDashboard(Carbon $from, Carbon $to): array
    {
        $notes = NursingNote::query()->whereBetween('recorded_at', [$from, $to])->count();
        $admitted = Patient::query()->where('status', 'admitted')->count();
        $dispenses = MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to])->count();
        $rounds = DoctorRound::query()->whereBetween('round_at', [$from, $to])->count();

        $patients = Patient::query()
            ->where('status', 'admitted')
            ->latest('id')
            ->limit(150)
            ->get(['patient_code', 'first_name', 'last_name', 'phone', 'status']);

        $noteRows = NursingNote::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->whereBetween('recorded_at', [$from, $to])
            ->latest('recorded_at')
            ->limit(100)
            ->get();

        return [
            'title' => 'Nurse dashboard',
            'kpis' => [
                ['key' => 'patients', 'label' => 'Active patients', 'value' => $admitted, 'meta' => 'Admitted now', 'tone' => 'orange'],
                ['key' => 'notes', 'label' => 'Nursing notes', 'value' => $notes, 'meta' => $this->rangeLabel($from, $to), 'tone' => 'blue'],
                ['key' => 'meds', 'label' => 'Dispenses', 'value' => $dispenses, 'meta' => "Rounds {$rounds}", 'tone' => 'green'],
            ],
            'charts' => [
                [
                    'id' => 'notes',
                    'title' => 'Nursing notes trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(NursingNote::query(), 'recorded_at', $from, $to),
                ],
            ],
            'tables' => [
                [
                    'title' => 'Admitted patients',
                    'total' => $patients->count(),
                    'columns' => ['Code', 'Name', 'Phone', 'Status'],
                    'rows' => $patients->map(fn (Patient $p) => [
                        $p->patient_code,
                        trim(($p->first_name ?? '').' '.($p->last_name ?? '')) ?: '—',
                        $p->phone ?: '—',
                        $p->status,
                    ])->values()->all(),
                ],
                [
                    'title' => 'Notes in range',
                    'total' => $noteRows->count(),
                    'columns' => ['Code', 'Patient', 'Shift', 'Mood', 'Date'],
                    'rows' => $noteRows->map(function (NursingNote $n) {
                        $name = trim(($n->patient?->first_name ?? '').' '.($n->patient?->last_name ?? ''));

                        return [
                            $n->note_code ?? ('#'.$n->id),
                            $name !== '' ? $name : ($n->patient?->patient_code ?: '—'),
                            $n->shift ?: '—',
                            $n->mood ?: '—',
                            optional($n->recorded_at)->toDateString() ?: '—',
                        ];
                    })->values()->all(),
                ],
            ],
            'links' => [
                ['to' => '/app/nursing', 'label' => 'Nursing notes'],
                ['to' => '/app/patients', 'label' => 'Patients'],
                ['to' => '/app/medical-records', 'label' => 'Medical records'],
                ['to' => '/app/pharmacy', 'label' => 'Pharmacy'],
            ],
            'alerts' => [['title' => 'Nursing', 'detail' => "{$notes} note(s) in range", 'level' => 'info']],
        ];
    }

    private function financeDashboard(Carbon $from, Carbon $to): array
    {
        $approvedPay = Payment::query()->where('approval_status', 'approved');
        $collection = (float) (clone $approvedPay)->whereBetween('paid_at', [$from, $to])->sum('amount');
        $payments = (clone $approvedPay)->whereBetween('paid_at', [$from, $to])->count();
        $pendingPayments = Payment::query()->where('approval_status', 'pending')->count();
        $pendingAmount = (float) Payment::query()->where('approval_status', 'pending')->sum('amount');
        $outstanding = (float) Invoice::query()->whereIn('status', ['unpaid', 'partial'])->sum('balance');
        $open = Invoice::query()->whereIn('status', ['unpaid', 'partial'])->count();
        $pharmacyExpense = round((float) MedicineMovement::query()
            ->where('type', 'in')
            ->whereBetween('moved_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0) as total')
            ->value('total'), 2);
        $inventoryExpense = round((float) InventoryMovement::query()
            ->where('inventory_movements.type', 'in')
            ->whereBetween('inventory_movements.moved_at', [$from, $to])
            ->leftJoin('inventory_items', 'inventory_items.id', '=', 'inventory_movements.inventory_item_id')
            ->selectRaw('COALESCE(SUM(inventory_movements.quantity * COALESCE(inventory_movements.unit_cost, inventory_items.unit_cost, 0)), 0) as total')
            ->value('total'), 2);
        $pettyExpense = round((float) PettyExpense::query()
            ->where('status', 'posted')
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount'), 2);
        $facilityExpense = round((float) FacilityBill::query()
            ->where('status', 'posted')
            ->whereBetween('bill_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount'), 2);
        $expense = round($pharmacyExpense + $inventoryExpense + $pettyExpense + $facilityExpense, 2);
        $profit = round($collection - $expense, 2);

        $invoices = Invoice::query()
            ->with('patient:id,first_name,last_name')
            ->whereIn('status', ['unpaid', 'partial', 'paid'])
            ->latest('id')
            ->limit(150)
            ->get();

        $paymentRows = Payment::query()
            ->where('approval_status', 'approved')
            ->whereBetween('paid_at', [$from, $to])
            ->latest('paid_at')
            ->limit(100)
            ->get();

        $pendingRows = Payment::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->where('approval_status', 'pending')
            ->latest('id')
            ->limit(50)
            ->get();

        $ledger = AccountEntry::query()
            ->where('status', 'posted')
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->latest('entry_date')
            ->limit(100)
            ->get();

        return [
            'title' => 'Finance dashboard',
            'kpis' => [
                ['key' => 'collection', 'label' => 'Approved collection', 'value' => $collection, 'money' => true, 'meta' => "{$payments} payment(s)", 'tone' => 'green'],
                ['key' => 'pending', 'label' => 'Pending approval', 'value' => $pendingAmount, 'money' => true, 'meta' => "{$pendingPayments} request(s)", 'tone' => 'orange'],
                ['key' => 'outstanding', 'label' => 'Outstanding', 'value' => $outstanding, 'money' => true, 'meta' => "{$open} invoice(s)", 'tone' => 'orange'],
                [
                    'key' => 'expense',
                    'label' => 'Expenses',
                    'value' => $expense,
                    'money' => true,
                    'meta' => 'Ops + facility',
                    'tone' => 'purple',
                    'detail' => [
                        'title' => 'Expense sources',
                        'columns' => ['Source', 'Total PKR'],
                        'allow_filter' => false,
                        'rows' => [
                            ['Pharmacy (medicine stock in)', number_format($pharmacyExpense, 0)],
                            ['Inventory (stock in)', number_format($inventoryExpense, 0)],
                            ['Petty expenses', number_format($pettyExpense, 0)],
                            ['Facility bills', number_format($facilityExpense, 0)],
                        ],
                    ],
                ],
                [
                    'key' => 'profit',
                    'label' => 'Net profit',
                    'value' => $profit,
                    'money' => true,
                    'meta' => 'Collection − expenses',
                    'tone' => $profit >= 0 ? 'green' : 'red',
                    'detail' => [
                        'title' => 'Net profit',
                        'columns' => ['Item', 'Amount'],
                        'allow_filter' => false,
                        'rows' => [
                            ['Collection', number_format($collection, 0)],
                            ['Pharmacy expense', number_format($pharmacyExpense, 0)],
                            ['Inventory expense', number_format($inventoryExpense, 0)],
                            ['Petty expenses', number_format($pettyExpense, 0)],
                            ['Facility bills', number_format($facilityExpense, 0)],
                            ['Total expenses', number_format($expense, 0)],
                            ['Net profit', number_format($profit, 0)],
                        ],
                    ],
                ],
            ],
            'charts' => [
                [
                    'id' => 'collection',
                    'title' => 'Approved collection trend (PKR)',
                    'type' => 'bar',
                    'series' => $this->sumSeries(Payment::query()->where('approval_status', 'approved'), 'paid_at', 'amount', $from, $to),
                ],
                [
                    'id' => 'net-profit',
                    'title' => 'Net profit trend (PKR)',
                    'type' => 'bar',
                    'series' => $this->financeNetProfitSeries($from, $to, true),
                ],
            ],
            'tables' => [
                [
                    'title' => 'Pending fee requests',
                    'total' => $pendingRows->count(),
                    'columns' => ['Code', 'Patient', 'Amount', 'Method'],
                    'rows' => $pendingRows->map(function (Payment $p) {
                        $name = trim(($p->patient?->patient_code ?? '').' '.($p->patient?->first_name ?? '').' '.($p->patient?->last_name ?? ''));

                        return [
                            $p->payment_code,
                            $name !== '' ? $name : '—',
                            number_format((float) $p->amount, 0),
                            $p->method ?? '—',
                        ];
                    })->values()->all(),
                ],
                [
                    'title' => 'Invoices',
                    'total' => $invoices->count(),
                    'columns' => ['Invoice', 'Patient', 'Total', 'Balance', 'Status'],
                    'rows' => $invoices->map(function (Invoice $inv) {
                        $name = trim(($inv->patient?->first_name ?? '').' '.($inv->patient?->last_name ?? ''));

                        return [
                            $inv->invoice_code,
                            $name !== '' ? $name : '—',
                            number_format((float) $inv->total_amount, 0),
                            number_format((float) $inv->balance, 0),
                            $inv->status,
                        ];
                    })->values()->all(),
                ],
                [
                    'title' => 'Approved payments in range',
                    'total' => $paymentRows->count(),
                    'columns' => ['Code', 'Amount', 'Method', 'Paid at'],
                    'rows' => $paymentRows->map(fn (Payment $p) => [
                        $p->payment_code ?? ('#'.$p->id),
                        number_format((float) $p->amount, 0),
                        $p->method ?? '—',
                        optional($p->paid_at)->toDateString() ?: '—',
                    ])->values()->all(),
                ],
                [
                    'title' => 'Ledger entries',
                    'total' => $ledger->count(),
                    'columns' => ['Date', 'Type', 'Amount', 'Status'],
                    'rows' => $ledger->map(fn (AccountEntry $e) => [
                        optional($e->entry_date)->toDateString() ?: (string) $e->entry_date,
                        $e->type,
                        number_format((float) $e->amount, 0),
                        $e->status,
                    ])->values()->all(),
                ],
            ],
            'links' => [
                ['to' => '/app/billing', 'label' => 'Fees & payments'],
                ['to' => '/app/accounts', 'label' => 'Accounts'],
                ['to' => '/app/reports', 'label' => 'Reports'],
            ],
            'alerts' => $open > 0
                ? [['title' => 'Fees due', 'detail' => "{$open} unpaid invoice(s)", 'level' => 'warning']]
                : [['title' => 'Fees clear', 'detail' => 'No open invoices', 'level' => 'success']],
        ];
    }

    private function pharmacistDashboard(Carbon $from, Carbon $to): array
    {
        $dispenses = MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to])->count();
        $qty = (float) MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to])->sum('quantity');
        $low = Medicine::query()->where('status', 'active')->whereColumn('stock_qty', '<=', 'reorder_level')->count();
        $activeMeds = Medicine::query()->where('status', 'active')->count();
        $meds = Medicine::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->limit(200)
            ->get(['medicine_code', 'name', 'stock_qty', 'reorder_level', 'unit']);

        $dispenseRows = MedicineDispense::query()
            ->with(['medicine:id,name,medicine_code', 'patient:id,first_name,last_name,patient_code'])
            ->whereBetween('dispensed_at', [$from, $to])
            ->latest('dispensed_at')
            ->limit(100)
            ->get();

        return [
            'title' => 'Dispenser dashboard',
            'kpis' => [
                ['key' => 'dispenses', 'label' => 'Dispenses', 'value' => $dispenses, 'meta' => $this->rangeLabel($from, $to), 'tone' => 'blue'],
                ['key' => 'qty', 'label' => 'Qty dispensed', 'value' => $qty, 'meta' => $this->rangeLabel($from, $to), 'tone' => 'green'],
                ['key' => 'low', 'label' => 'Low medicine', 'value' => $low, 'meta' => "of {$activeMeds}", 'tone' => 'orange'],
            ],
            'charts' => [
                [
                    'id' => 'dispenses',
                    'title' => 'Dispense trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(MedicineDispense::query(), 'dispensed_at', $from, $to),
                ],
                [
                    'id' => 'stock-in',
                    'title' => 'Stock in trend',
                    'type' => 'bar',
                    'series' => $this->sumSeries(
                        MedicineMovement::query()->where('type', 'in'),
                        'moved_at',
                        'quantity',
                        $from,
                        $to
                    ),
                ],
            ],
            'tables' => [
                [
                    'title' => 'Medicines',
                    'total' => $meds->count(),
                    'columns' => ['Code', 'Name', 'Qty', 'Reorder', 'Status'],
                    'rows' => $meds->map(function (Medicine $m) {
                        $status = (float) $m->stock_qty <= 0
                            ? 'Critical'
                            : ((float) $m->stock_qty <= (float) $m->reorder_level ? 'Low' : 'Good');

                        return [
                            $m->medicine_code,
                            $m->name,
                            trim($m->stock_qty.' '.($m->unit ?: '')),
                            (string) $m->reorder_level,
                            $status,
                        ];
                    })->values()->all(),
                ],
                [
                    'title' => 'Dispenses in range',
                    'total' => $dispenseRows->count(),
                    'columns' => ['Code', 'Medicine', 'Patient', 'Qty', 'Date'],
                    'rows' => $dispenseRows->map(function (MedicineDispense $d) {
                        $patient = trim(($d->patient?->first_name ?? '').' '.($d->patient?->last_name ?? ''));

                        return [
                            $d->dispense_code ?? ('#'.$d->id),
                            $d->medicine?->name ?: ($d->medicine?->medicine_code ?: '—'),
                            $patient !== '' ? $patient : ($d->patient?->patient_code ?: '—'),
                            (string) $d->quantity,
                            optional($d->dispensed_at)->toDateString() ?: '—',
                        ];
                    })->values()->all(),
                ],
            ],
            'links' => [
                ['to' => '/app/pharmacy', 'label' => 'Medicines & dispense'],
                ['to' => '/app/inventory', 'label' => 'Inventory'],
            ],
            'alerts' => $low > 0
                ? [['title' => 'Low medicine stock', 'detail' => "{$low} medicine(s) need restock", 'level' => 'warning']]
                : [['title' => 'Pharmacy stock', 'detail' => 'No low-stock medicines', 'level' => 'success']],
        ];
    }

    private function adminInventoryBillsSection(
        Carbon $from,
        Carbon $to,
        ?int $createdBy = null,
        ?string $billType = null
    ): array {
        $base = FacilityBill::query()
            ->where('status', 'posted')
            ->whereBetween('bill_date', [$from->toDateString(), $to->toDateString()]);
        if ($createdBy) {
            $base->where('created_by', $createdBy);
        }
        if ($billType) {
            $base->where('bill_type', $billType);
        }

        $totalAmount = round((float) (clone $base)->sum('amount'), 2);
        $entries = (clone $base)->count();
        $avg = $entries > 0 ? round($totalAmount / $entries, 2) : 0;

        $rows = (clone $base)
            ->with('creator:id,name')
            ->latest('bill_date')
            ->latest('id')
            ->limit(300)
            ->get();

        $mapBillRow = function (FacilityBill $b) {
            return [
                $b->bill_code,
                FacilityBill::typeLabel($b->bill_type),
                number_format((float) $b->amount, 2, '.', ''),
                $b->payment_method ?: '—',
                $b->notes ?: '—',
                $b->creator?->name ?: '—',
                optional($b->bill_date)->toDateString() ?: '—',
            ];
        };

        $detailRows = $rows->map($mapBillRow)->values()->all();

        $byType = (clone $base)
            ->selectRaw('bill_type, SUM(amount) as total, COUNT(*) as c')
            ->groupBy('bill_type')
            ->orderByDesc('total')
            ->get()
            ->keyBy('bill_type');

        $typeKeys = collect(FacilityBill::TYPES)
            ->merge($byType->keys())
            ->unique()
            ->values();

        $tones = ['blue', 'orange', 'green', 'purple', 'red', 'blue'];
        $typeKpis = [];
        foreach ($typeKeys as $i => $typeKey) {
            $typeKey = (string) $typeKey;
            $sum = round((float) ($byType[$typeKey]->total ?? 0), 2);
            $count = (int) ($byType[$typeKey]->c ?? 0);
            $typeRows = $rows->where('bill_type', $typeKey)->map($mapBillRow)->values()->all();

            $typeKpis[] = [
                'key' => 'type_'.$typeKey,
                'label' => FacilityBill::typeLabel($typeKey),
                'value' => $sum,
                'money' => true,
                'meta' => "{$count} bill(s)",
                'tone' => $tones[$i % count($tones)],
                'detail' => [
                    'title' => FacilityBill::typeLabel($typeKey).' bills',
                    'columns' => ['Code', 'Type', 'Amount', 'Pay', 'Notes', 'Entered by', 'Date'],
                    'allow_filter' => false,
                    'staff_filter_column' => 'Entered by',
                    'search_placeholder' => 'Search bill',
                    'rows' => $typeRows,
                ],
            ];
        }

        $trend = FacilityBill::query()
            ->where('status', 'posted')
            ->whereBetween('bill_date', [$from->toDateString(), $to->toDateString()]);
        if ($createdBy) {
            $trend->where('created_by', $createdBy);
        }
        if ($billType) {
            $trend->where('bill_type', $billType);
        }

        return [
            'title' => 'Facility bills',
            'card_mode' => 'modal',
            'staff_filter' => true,
            'kpis' => array_merge([
                [
                    'key' => 'total',
                    'label' => 'Total bills',
                    'value' => $totalAmount,
                    'money' => true,
                    'meta' => $this->rangeLabel($from, $to),
                    'tone' => 'red',
                    'detail' => [
                        'title' => 'Facility bills',
                        'columns' => ['Code', 'Type', 'Amount', 'Pay', 'Notes', 'Entered by', 'Date'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search bill',
                        'rows' => $detailRows,
                    ],
                ],
                [
                    'key' => 'avg',
                    'label' => 'Avg bill',
                    'value' => $avg,
                    'money' => true,
                    'meta' => 'Per entry',
                    'tone' => 'purple',
                ],
            ], $typeKpis),
            'charts' => [
                [
                    'id' => 'bills-trend',
                    'title' => 'Bills trend',
                    'type' => 'bar',
                    'series' => $this->sumSeries($trend, 'bill_date', 'amount', $from, $to),
                ],
                [
                    'id' => 'bills-by-type',
                    'title' => 'By type',
                    'type' => 'bar',
                    'series' => $byType->map(fn ($r) => [
                        'label' => FacilityBill::typeLabel($r->bill_type),
                        'value' => round((float) $r->total, 2),
                    ])->values()->all(),
                ],
            ],
        ];
    }

    private function adminInventoryPettySection(
        Carbon $from,
        Carbon $to,
        ?int $createdBy = null,
        ?string $spentFor = null
    ): array {
        $base = PettyExpense::query()
            ->where('status', 'posted')
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()]);
        if ($createdBy) {
            $base->where('created_by', $createdBy);
        }
        if ($spentFor) {
            $base->where('spent_for', $spentFor);
        }

        $totalAmount = round((float) (clone $base)->sum('amount'), 2);
        $entries = (clone $base)->count();
        $avg = $entries > 0 ? round($totalAmount / $entries, 2) : 0;
        $highest = round((float) (clone $base)->max('amount'), 2);

        $rows = (clone $base)
            ->with('creator:id,name')
            ->latest('expense_date')
            ->latest('id')
            ->limit(300)
            ->get();

        $mapRow = function (PettyExpense $e) {
            return [
                $e->expense_code,
                $e->title,
                number_format((float) $e->amount, 2, '.', ''),
                $e->spent_for ?: '—',
                $e->reason ?: '—',
                $e->creator?->name ?: '—',
                $e->payment_method ?: '—',
                optional($e->expense_date)->toDateString() ?: '—',
            ];
        };

        $detailRows = $rows->map($mapRow)->values()->all();
        $highestRows = $rows
            ->sortByDesc(fn (PettyExpense $e) => (float) $e->amount)
            ->take(20)
            ->map($mapRow)
            ->values()
            ->all();

        $byPerson = (clone $base)
            ->selectRaw('spent_for, SUM(amount) as total, COUNT(*) as c')
            ->groupBy('spent_for')
            ->orderByDesc('total')
            ->limit(12)
            ->get();

        $trend = PettyExpense::query()
            ->where('status', 'posted')
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()]);
        if ($createdBy) {
            $trend->where('created_by', $createdBy);
        }
        if ($spentFor) {
            $trend->where('spent_for', $spentFor);
        }

        return [
            'title' => 'Petty expenses',
            'card_mode' => 'modal',
            'staff_filter' => true,
            'kpis' => [
                [
                    'key' => 'total',
                    'label' => 'Total spent',
                    'value' => $totalAmount,
                    'money' => true,
                    'meta' => $this->rangeLabel($from, $to),
                    'tone' => 'red',
                    'detail' => [
                        'title' => 'Petty expenses',
                        'columns' => ['Code', 'Item', 'Amount', 'Spent for', 'Reason', 'Entered by', 'Pay', 'Date'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search item / reason',
                        'rows' => $detailRows,
                    ],
                ],
                [
                    'key' => 'transactions',
                    'label' => 'Total transactions',
                    'value' => $entries,
                    'meta' => 'Posted entries',
                    'tone' => 'orange',
                ],
                [
                    'key' => 'highest',
                    'label' => 'Highest entry',
                    'value' => $highest,
                    'money' => true,
                    'meta' => 'Largest single',
                    'tone' => 'blue',
                    'detail' => [
                        'title' => 'Largest petty entries',
                        'columns' => ['Code', 'Item', 'Amount', 'Spent for', 'Reason', 'Entered by', 'Pay', 'Date'],
                        'allow_filter' => false,
                        'search_placeholder' => 'Search item / reason',
                        'rows' => $highestRows,
                    ],
                ],
                [
                    'key' => 'avg',
                    'label' => 'Avg entry',
                    'value' => $avg,
                    'money' => true,
                    'meta' => 'Per entry',
                    'tone' => 'purple',
                ],
            ],
            'charts' => [
                [
                    'id' => 'petty-trend',
                    'title' => 'Spend trend',
                    'type' => 'bar',
                    'series' => $this->sumSeries($trend, 'expense_date', 'amount', $from, $to),
                ],
                [
                    'id' => 'petty-by-person',
                    'title' => 'By person',
                    'type' => 'bar',
                    'series' => $byPerson->map(fn ($r) => [
                        'label' => $r->spent_for ?: '—',
                        'value' => round((float) $r->total, 2),
                    ])->values()->all(),
                ],
            ],
        ];
    }

    private function qtyLabel(float $qty, ?string $unit): string
    {
        $formatted = rtrim(rtrim(number_format($qty, 2, '.', ''), '0'), '.');

        return trim($formatted.' '.($unit ?: ''));
    }

    private function staffOptionsByRole(array $roleSlugs): array
    {
        return User::query()
            ->where('is_active', true)
            ->whereHas('role', fn ($q) => $q->whereIn('slug', $roleSlugs))
            ->orderBy('name')
            ->get(['id', 'name', 'staff_code'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'staff_code' => $u->staff_code,
            ])
            ->values()
            ->all();
    }

    private function inventoryMovementDetail(
        $moveRows,
        string $title = 'Stock movements',
        bool $showType = true,
        bool $showReceiptDetails = false
    ): array
    {
        $columns = ['Code', 'Item'];
        if ($showType) {
            $columns[] = 'Type';
        }
        $columns[] = 'Qty';
        if ($showReceiptDetails) {
            $columns = array_merge($columns, ['Unit cost (PKR)', 'Total cost (PKR)', 'Bill']);
        }
        $columns = array_merge($columns, [
            'Purpose',
            $showReceiptDetails ? 'Supplier' : 'Person',
            'Dept',
            'Recorded by',
            'Date',
        ]);

        return [
            'title' => $title,
            'columns' => $columns,
            'allow_filter' => false,
            'staff_filter_column' => 'Recorded by',
            'search_placeholder' => 'Search by item',
            'rows' => collect($moveRows)->map(function (InventoryMovement $m) use ($showType, $showReceiptDetails) {
                $unit = $m->unit ?: ($m->item?->unit ?: '');
                $row = [
                    $m->movement_code ?? ('#'.$m->id),
                    $m->item?->name ?: ($m->item?->item_code ?: '—'),
                ];
                if ($showType) {
                    $row[] = $m->type;
                }
                $row[] = $this->qtyLabel((float) $m->quantity, $unit);
                if ($showReceiptDetails) {
                    $unitCost = $m->unit_cost ?? $m->item?->unit_cost;
                    $row[] = $unitCost !== null ? number_format((float) $unitCost, 2) : '—';
                    $row[] = $unitCost !== null
                        ? number_format((float) $m->quantity * (float) $unitCost, 2)
                        : '—';
                    $row[] = SecureUpload::url($m->bill_image_path) ?: '—';
                }
                $row[] = $m->purpose ? str_replace('_', ' ', $m->purpose) : '—';
                $row[] = $m->issued_to ?: '—';
                $row[] = $m->department ? str_replace('_', ' ', $m->department) : '—';
                $row[] = $m->creator?->name ?: '—';
                $row[] = optional($m->moved_at)->toDateTimeString() ?: '—';

                return $row;
            })->values()->all(),
        ];
    }

    /** Merge empty/null categories into "other" after a plain GROUP BY (MySQL ONLY_FULL_GROUP_BY safe). */
    private function collapseCategoryCounts($rows)
    {
        return collect($rows)
            ->groupBy(fn ($row) => ($row->category !== null && $row->category !== '') ? (string) $row->category : 'other')
            ->map(fn ($group, $category) => (object) [
                'category' => $category,
                'c' => (int) $group->sum(fn ($r) => (int) $r->c),
            ])
            ->sortByDesc('c')
            ->values();
    }

    /**
     * Compact tooltip: section label + "Category: count" lines, blank gap between sections.
     * Extra args: optional second section ($label2, $rows2, $labelFn2).
     */
    private function categoryTooltipLines(
        string $label1,
        $rows1,
        callable $labelFn1,
        ?string $label2 = null,
        $rows2 = null,
        ?callable $labelFn2 = null,
    ): array {
        $lines = [];
        $rows1 = collect($rows1);
        if ($rows1->isNotEmpty()) {
            $lines[] = $label1;
            foreach ($rows1 as $row) {
                $lines[] = $labelFn1($row->category).': '.$row->c;
            }
        }
        $rows2 = collect($rows2);
        if ($label2 && $rows2->isNotEmpty()) {
            if ($lines !== []) {
                $lines[] = '';
            }
            $lines[] = $label2;
            foreach ($rows2 as $row) {
                $fn = $labelFn2 ?: $labelFn1;
                $lines[] = $fn($row->category).': '.$row->c;
            }
        }

        return $lines;
    }

    private function buildAlerts(int $lowMedicines, int $lowInventory, int $openInvoices): array
    {
        $alerts = [];
        if ($lowMedicines > 0) {
            $alerts[] = ['title' => 'Low medicine stock', 'detail' => "{$lowMedicines} medicine(s) at or below reorder level", 'level' => 'warning'];
        }
        if ($lowInventory > 0) {
            $alerts[] = ['title' => 'Low inventory stock', 'detail' => "{$lowInventory} inventory item(s) need restock", 'level' => 'warning'];
        }
        if ($openInvoices > 0) {
            $alerts[] = ['title' => 'Fee outstanding', 'detail' => "{$openInvoices} unpaid invoice(s)", 'level' => 'info'];
        }
        if ($alerts === []) {
            $alerts[] = ['title' => 'All clear', 'detail' => 'No critical alerts right now', 'level' => 'success'];
        }

        return $alerts;
    }

    /** Human-readable date range for KPI footers (not "Selected range"). */
    private function rangeLabel(Carbon $from, Carbon $to): string
    {
        if ($from->isSameDay($to)) {
            return 'On '.$from->format('j M Y');
        }

        if ($from->day === 1 && $to->isSameMonth($from) && $to->day === $to->daysInMonth) {
            return 'In '.$from->format('M Y');
        }

        if ($from->month === 1 && $from->day === 1 && $to->month === 12 && $to->day === 31 && $from->isSameYear($to)) {
            return 'In year '.$from->year;
        }

        $days = (int) round($from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1);
        if ($to->isToday() && $days >= 1 && $days <= 31) {
            return $days === 1 ? 'Today' : 'Last '.$days.' days';
        }

        if ($from->year <= 2000 && $to->isToday()) {
            return 'All time';
        }

        return $from->format('j M Y').' – '.$to->format('j M Y');
    }

    private function countSeries($query, string $column, Carbon $from, Carbon $to): array
    {
        if ($from->diffInDays($to) > 45) {
            $rows = (clone $query)
                ->selectRaw('DATE_FORMAT('.$column.', "%Y-%m") as d, COUNT(*) as c')
                ->whereBetween($column, [$from, $to])
                ->groupBy('d')
                ->pluck('c', 'd');

            return $this->fillMonthlySeries($from, $to, $rows);
        }

        $rows = (clone $query)
            ->selectRaw('DATE('.$column.') as d, COUNT(*) as c')
            ->whereBetween($column, [$from, $to])
            ->groupBy('d')
            ->pluck('c', 'd');

        return $this->fillDailySeries($from, $to, $rows);
    }

    /**
     * Year-over-year admissions (cumulative by month), like a live comparison chart.
     * Falls back to demo values when the DB has no admission rows yet.
     * TODO: remove demo fallback before production cutover.
     */
    private function admissionsYearCompareChart(): array
    {
        $now = Carbon::now();
        $thisYear = (int) $now->year;
        $prevYear = $thisYear - 1;
        $currentMonth = (int) $now->month; // 1–12
        $categories = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        $prevMonthly = $this->monthlyAdmissionCounts($prevYear);
        $currMonthly = $this->monthlyAdmissionCounts($thisYear);
        $realTotal = array_sum($prevMonthly) + array_sum($currMonthly);
        // TODO: set $forceDemo = false (or remove) before production — dummy is for UI review only.
        $forceDemo = true;
        $demo = $forceDemo || $realTotal <= 0;

        if ($demo) {
            // Demo shape for UI review only — not real facility data.
            $prevMonthly = [0, 0, 0, 0, 2, 3, 4, 5, 4, 3, 3, 4];
            $currMonthly = [1, 2, 2, 3, 4, 3, 4, 3, 4, 3, 2, 0];
        }

        $prevCum = $this->cumulativeMonthly($prevMonthly, 12);
        $currCum = $this->cumulativeMonthly($currMonthly, $currentMonth);

        return [
            'id' => 'admissions-trend',
            'title' => $demo
                ? 'Admissions · year comparison (demo)'
                : 'Admissions · year comparison',
            'type' => 'compare',
            'categories' => $categories,
            'lines' => [
                [
                    'key' => 'prev',
                    'label' => $prevYear.' · full year',
                    'color' => '#d4a017',
                    'values' => $prevCum,
                ],
                [
                    'key' => 'curr',
                    'label' => $thisYear.' · YTD',
                    'color' => '#e07020',
                    'values' => $currCum,
                ],
            ],
        ];
    }

    /** @return list<int> length 12, index 0 = Jan */
    private function monthlyAdmissionCounts(int $year): array
    {
        $counts = array_fill(0, 12, 0);
        $rows = Admission::query()
            ->selectRaw('MONTH(admitted_at) as m, COUNT(*) as c')
            ->whereYear('admitted_at', $year)
            ->groupBy('m')
            ->pluck('c', 'm');

        foreach ($rows as $month => $count) {
            $idx = ((int) $month) - 1;
            if ($idx >= 0 && $idx < 12) {
                $counts[$idx] = (int) $count;
            }
        }

        return $counts;
    }

    /**
     * @param  list<int|float>  $monthly
     * @return list<float|null>
     */
    private function cumulativeMonthly(array $monthly, int $throughMonth): array
    {
        $out = [];
        $sum = 0.0;
        for ($i = 0; $i < 12; $i++) {
            if ($i >= $throughMonth) {
                $out[] = null;
                continue;
            }
            $sum += (float) ($monthly[$i] ?? 0);
            $out[] = $sum;
        }

        return $out;
    }

    /** Only dates/months that have real events (no empty placeholder dates). */
    private function sparseCountSeries($query, string $column, Carbon $from, Carbon $to): array
    {
        $spanDays = $from->diffInDays($to);
        if ($spanDays > 45) {
            $rows = (clone $query)
                ->selectRaw('DATE_FORMAT('.$column.', "%Y-%m") as d, COUNT(*) as c')
                ->whereBetween($column, [$from, $to])
                ->groupBy('d')
                ->orderBy('d')
                ->get();

            return $rows
                ->filter(fn ($r) => (int) $r->c > 0)
                ->map(function ($r) {
                    $month = Carbon::createFromFormat('Y-m', $r->d)->startOfMonth();

                    return [
                        'label' => $month->format('M Y'),
                        'value' => (float) $r->c,
                    ];
                })
                ->values()
                ->all();
        }

        $rows = (clone $query)
            ->selectRaw('DATE('.$column.') as d, COUNT(*) as c')
            ->whereBetween($column, [$from, $to])
            ->groupBy('d')
            ->orderBy('d')
            ->get();

        return $rows
            ->filter(fn ($r) => (int) $r->c > 0)
            ->map(function ($r) {
                $day = Carbon::parse($r->d);

                return [
                    'label' => $day->format('d M'),
                    'value' => (float) $r->c,
                ];
            })
            ->values()
            ->all();
    }

    private function sumSeries($query, string $column, string $sumColumn, Carbon $from, Carbon $to): array
    {
        return $this->sumExprSeries($query, $column, 'SUM('.$sumColumn.')', $from, $to);
    }

    private function sumExprSeries($query, string $column, string $sumExpr, Carbon $from, Carbon $to): array
    {
        if ($from->diffInDays($to) > 45) {
            $rows = (clone $query)
                ->selectRaw('DATE_FORMAT('.$column.', "%Y-%m") as d, COALESCE('.$sumExpr.',0) as c')
                ->whereBetween($column, [$from, $to])
                ->groupBy('d')
                ->pluck('c', 'd');

            return $this->fillMonthlySeries($from, $to, $rows);
        }

        $rows = (clone $query)
            ->selectRaw('DATE('.$column.') as d, COALESCE('.$sumExpr.',0) as c')
            ->whereBetween($column, [$from, $to])
            ->groupBy('d')
            ->pluck('c', 'd');

        return $this->fillDailySeries($from, $to, $rows);
    }

    /** Collection − (pharmacy stock-in + inventory stock-in + petty + facility) by period. */
    private function financeNetProfitSeries(Carbon $from, Carbon $to, bool $approvedOnly = false): array
    {
        $collectionQuery = Payment::query();
        if ($approvedOnly) {
            $collectionQuery->where('approval_status', 'approved');
        }

        $collection = $this->sumSeries($collectionQuery, 'paid_at', 'amount', $from, $to);

        $pharmacy = $this->sumExprSeries(
            MedicineMovement::query()->where('type', 'in'),
            'moved_at',
            'SUM(quantity * COALESCE(unit_cost, 0))',
            $from,
            $to
        );

        $inventory = $this->sumExprSeries(
            InventoryMovement::query()
                ->where('inventory_movements.type', 'in')
                ->leftJoin('inventory_items', 'inventory_items.id', '=', 'inventory_movements.inventory_item_id'),
            'inventory_movements.moved_at',
            'SUM(inventory_movements.quantity * COALESCE(inventory_movements.unit_cost, inventory_items.unit_cost, 0))',
            $from,
            $to
        );

        $petty = $this->sumSeries(
            PettyExpense::query()->where('status', 'posted'),
            'expense_date',
            'amount',
            $from,
            $to
        );

        $facility = $this->sumSeries(
            FacilityBill::query()->where('status', 'posted'),
            'bill_date',
            'amount',
            $from,
            $to
        );

        $series = [];
        foreach ($collection as $i => $point) {
            $value = (float) ($point['value'] ?? 0)
                - (float) ($pharmacy[$i]['value'] ?? 0)
                - (float) ($inventory[$i]['value'] ?? 0)
                - (float) ($petty[$i]['value'] ?? 0)
                - (float) ($facility[$i]['value'] ?? 0);

            $series[] = [
                'label' => $point['label'],
                'value' => round($value, 2),
            ];
        }

        return $series;
    }

    /** @deprecated keep aliases for any leftover calls */
    private function dailyCountSeries($query, string $column, Carbon $from, Carbon $to): array
    {
        return $this->countSeries($query, $column, $from, $to);
    }

    private function dailySumSeries($query, string $column, string $sumColumn, Carbon $from, Carbon $to): array
    {
        return $this->sumSeries($query, $column, $sumColumn, $from, $to);
    }

    private function fillDailySeries(Carbon $from, Carbon $to, $rows): array
    {
        $series = [];
        foreach (CarbonPeriod::create($from->copy()->startOfDay(), $to->copy()->startOfDay()) as $day) {
            $key = $day->toDateString();
            $series[] = [
                'label' => $day->format('d M'),
                'value' => (float) ($rows[$key] ?? 0),
            ];
        }

        return $series;
    }

    private function fillMonthlySeries(Carbon $from, Carbon $to, $rows): array
    {
        $series = [];
        $cursor = $from->copy()->startOfMonth();
        $end = $to->copy()->startOfMonth();
        while ($cursor->lte($end)) {
            $key = $cursor->format('Y-m');
            $series[] = [
                'label' => $cursor->format('M Y'),
                'value' => (float) ($rows[$key] ?? 0),
            ];
            $cursor->addMonth();
        }

        return $series;
    }
}
