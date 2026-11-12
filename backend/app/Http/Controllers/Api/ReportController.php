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
use App\Models\User;
use App\Models\VisitorLog;
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
                'pharmacy_staff' => $this->staffOptionsByRole(['pharmacist']),
                'inventory_staff' => $this->staffOptionsByRole(['inventory-manager']),
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
            ->whereColumn('stock_qty', '<=', 'reorder_level')
            ->count();
        $inventoryCritical = InventoryItem::query()
            ->where('status', 'active')
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
                    'pharmacist',
                    'inventory-manager',
                ]),
            ],
            'section' => [
                'nullable',
                'string',
                Rule::in(['overview', 'patients', 'pharmacy', 'inventory', 'finance', 'visitors', 'staff']),
            ],
            'created_by' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $to = isset($data['to'])
            ? Carbon::parse($data['to'])->endOfDay()
            : now()->endOfDay();
        $from = isset($data['from'])
            ? Carbon::parse($data['from'])->startOfDay()
            : Carbon::create(2000, 1, 1)->startOfDay();
        $createdBy = isset($data['created_by']) ? (int) $data['created_by'] : null;

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

        $payload = match ($scope) {
            'admin' => $this->adminOverview($from, $to),
            'receptionist' => $this->receptionistDashboard($from, $to),
            'gatekeeper' => $this->gatekeeperDashboard($from, $to),
            'doctor' => $this->doctorDashboard($from, $to),
            'nurse' => $this->nurseDashboard($from, $to),
            'finance' => $this->financeDashboard($from, $to),
            'pharmacist' => $this->pharmacistDashboard($from, $to),
            'inventory-manager' => $this->inventoryDashboard($from, $to),
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
        $invoiceUnpaidCount = Invoice::query()->where('status', 'unpaid')->count();
        $invoicePartialCount = Invoice::query()->where('status', 'partial')->count();
        $outstanding = $invoiceUnpaidBalance;
        $openInvoices = $invoiceUnpaidCount + $invoicePartialCount;
        $activeStaff = User::query()->where('is_active', true)->count();
        $inactiveStaff = User::query()->where('is_active', false)->count();
        $staffByRole = User::query()
            ->with('role:id,name')
            ->where('is_active', true)
            ->get()
            ->groupBy(fn (User $u) => $u->role?->name ?: 'No role')
            ->map->count();
        $activeMeds = Medicine::query()->where('status', 'active')->count();
        $lowMedicines = Medicine::query()->where('status', 'active')->whereColumn('stock_qty', '<=', 'reorder_level')->count();
        $criticalMedicines = Medicine::query()->where('status', 'active')->where('stock_qty', '<=', 0)->count();
        $healthyMedicines = max(0, $activeMeds - $lowMedicines);
        $activeInventory = InventoryItem::query()->where('status', 'active')->count();
        $lowInventory = InventoryItem::query()->where('status', 'active')->whereColumn('stock_qty', '<=', 'reorder_level')->count();
        $criticalInventory = InventoryItem::query()->where('status', 'active')->where('stock_qty', '<=', 0)->count();
        $visitorsInRange = VisitorLog::query()->whereBetween('check_in_at', [$from, $to])->count();
        $visitorsInside = VisitorLog::query()->where('status', 'checked_in')->count();
        $visitorsOut = VisitorLog::query()
            ->whereBetween('check_in_at', [$from, $to])
            ->where('status', 'checked_out')
            ->count();
        $partySize = (int) VisitorLog::query()->whereBetween('check_in_at', [$from, $to])->sum('party_size');
        $admissionsInRange = Admission::query()->whereBetween('admitted_at', [$from, $to])->count();
        $activeAdmissions = Admission::query()->where('status', 'active')->count();
        $dischargesInRange = Discharge::query()->whereBetween('discharged_at', [$from, $to])->count();
        $dispensesInRange = MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to])->count();
        $dispenseQty = (float) MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to])->sum('quantity');
        $money = fn (float $n) => 'PKR '.number_format($n, 0);

        $collectionLines = [
            'Total collected: '.$money($collectionInRange),
            "Payments: {$paymentCount}",
        ];
        foreach ($paymentsByMethod as $row) {
            $method = $row->method ?: 'other';
            $collectionLines[] = ucfirst((string) $method).': '.$money((float) $row->total)." ({$row->c})";
        }

        $staffLines = [
            "Active: {$activeStaff}",
            "Inactive: {$inactiveStaff}",
        ];
        foreach ($staffByRole as $roleName => $count) {
            $staffLines[] = "{$roleName}: {$count}";
        }

        return [
            'title' => 'Facility overview',
            'card_mode' => 'tooltip',
            'kpis' => [
                [
                    'key' => 'total_patients',
                    'label' => 'Total patients',
                    'value' => $totalPatients,
                    'meta' => "{$admittedPatients} admitted",
                    'tone' => 'orange',
                    'tooltip_lines' => [
                        "Registered: {$registeredPatients}",
                        "Admitted: {$admittedPatients}",
                        "Discharged: {$dischargedPatients}",
                        "Total: {$totalPatients}",
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
                    'meta' => 'Selected range',
                    'tone' => 'blue',
                    'tooltip_lines' => [
                        "In range: {$admissionsInRange}",
                        "Active stays: {$activeAdmissions}",
                        "Discharges in range: {$dischargesInRange}",
                    ],
                ],
                [
                    'key' => 'discharges',
                    'label' => 'Discharges',
                    'value' => $dischargesInRange,
                    'meta' => 'Selected range',
                    'tone' => 'purple',
                    'tooltip_lines' => [
                        "Discharges in range: {$dischargesInRange}",
                        "Admissions in range: {$admissionsInRange}",
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
                    'label' => 'Outstanding',
                    'value' => $outstanding,
                    'money' => true,
                    'meta' => "{$openInvoices} invoice(s)",
                    'tone' => 'red',
                    'tooltip_lines' => [
                        'Total paid: '.$money($invoicePaidTotal),
                        'Total unpaid: '.$money($invoiceUnpaidBalance),
                        "Paid invoices: {$invoicePaidCount}",
                        "Unpaid: {$invoiceUnpaidCount}",
                        "Partial: {$invoicePartialCount}",
                    ],
                ],
                [
                    'key' => 'visitors',
                    'label' => 'Visitors',
                    'value' => $visitorsInRange,
                    'meta' => "{$visitorsInside} inside now",
                    'tone' => 'orange',
                    'tooltip_lines' => [
                        "Logged in range: {$visitorsInRange}",
                        "Currently inside: {$visitorsInside}",
                        "Checked out: {$visitorsOut}",
                        "Party size: {$partySize}",
                    ],
                ],
                [
                    'key' => 'pharmacy',
                    'label' => 'Dispenses',
                    'value' => $dispensesInRange,
                    'meta' => "Low meds {$lowMedicines}",
                    'tone' => 'blue',
                    'tooltip_lines' => [
                        "Dispenses: {$dispensesInRange}",
                        "Qty dispensed: {$dispenseQty}",
                        "Healthy stock: {$healthyMedicines}",
                        "Low: {$lowMedicines}",
                        "Critical: {$criticalMedicines}",
                    ],
                ],
                [
                    'key' => 'inventory',
                    'label' => 'Low inventory',
                    'value' => $lowInventory,
                    'meta' => 'Needs restock',
                    'tone' => 'red',
                    'tooltip_lines' => [
                        "Active items: {$activeInventory}",
                        "Low stock: {$lowInventory}",
                        "Critical: {$criticalInventory}",
                        'Healthy: '.max(0, $activeInventory - $lowInventory),
                    ],
                ],
                [
                    'key' => 'staff',
                    'label' => 'Active staff',
                    'value' => $activeStaff,
                    'meta' => "Inactive {$inactiveStaff}",
                    'tone' => 'purple',
                    'tooltip_lines' => $staffLines,
                ],
                [
                    'key' => 'open_invoices',
                    'label' => 'Open invoices',
                    'value' => $openInvoices,
                    'meta' => 'Unpaid / partial',
                    'tone' => 'orange',
                    'tooltip_lines' => [
                        'Total paid: '.$money($invoicePaidTotal),
                        'Total unpaid: '.$money($invoiceUnpaidBalance),
                        "Paid invoices: {$invoicePaidCount}",
                        "Unpaid invoices: {$invoiceUnpaidCount}",
                        "Partial invoices: {$invoicePartialCount}",
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
                    'series' => $this->countSeries(VisitorLog::query(), 'check_in_at', $from, $to),
                ],
            ],
        ];
    }

    private function adminPatientsSection(Carbon $from, Carbon $to): array
    {
        $totalBeds = Bed::query()->where('status', '!=', 'discarded')->count();
        $occupiedBeds = Bed::query()->where('status', 'occupied')->count();
        $availableBeds = Bed::query()->where('status', 'available')->count();
        $occupancy = $totalBeds > 0 ? round(($occupiedBeds / $totalBeds) * 100, 1) : 0;
        $totalPatients = Patient::query()->count();
        $admitted = Patient::query()->where('status', 'admitted')->count();
        $registered = Patient::query()->where('status', 'registered')->count();
        $dischargedStatus = Patient::query()->where('status', 'discharged')->count();
        $admissions = Admission::query()->whereBetween('admitted_at', [$from, $to])->count();
        $discharges = Discharge::query()->whereBetween('discharged_at', [$from, $to])->count();

        $patients = Patient::query()
            ->latest('id')
            ->limit(200)
            ->get(['id', 'patient_code', 'first_name', 'last_name', 'phone', 'cnic', 'status', 'created_at']);

        $beds = Bed::query()
            ->with('room:id,name,code')
            ->orderBy('bed_code')
            ->limit(200)
            ->get();

        $admissionRows = Admission::query()
            ->with(['patient:id,first_name,last_name,patient_code', 'bed:id,bed_code'])
            ->whereBetween('admitted_at', [$from, $to])
            ->latest('admitted_at')
            ->limit(100)
            ->get();

        $patientRows = $patients->map(function (Patient $p) {
            $name = trim(($p->first_name ?? '').' '.($p->last_name ?? ''));

            return [
                $p->patient_code,
                $name !== '' ? $name : '—',
                $p->phone ?: '—',
                $p->cnic ?: '—',
                $p->status,
            ];
        })->values()->all();

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

        return [
            'title' => 'Patients & beds overview',
            'card_mode' => 'modal',
            'kpis' => [
                [
                    'key' => 'total',
                    'label' => 'Total patients',
                    'value' => $totalPatients,
                    'meta' => "Discharged {$dischargedStatus}",
                    'tone' => 'blue',
                    'detail' => [
                        'title' => 'All patients',
                        'columns' => ['Code', 'Name', 'Phone', 'CNIC', 'Status'],
                        'filter_column' => 'Status',
                        'rows' => $patientRows,
                    ],
                ],
                [
                    'key' => 'admitted',
                    'label' => 'Admitted',
                    'value' => $admitted,
                    'meta' => "Registered {$registered}",
                    'tone' => 'orange',
                    'detail' => [
                        'title' => 'Patients by status',
                        'columns' => ['Code', 'Name', 'Phone', 'CNIC', 'Status'],
                        'filter_column' => 'Status',
                        'rows' => $patientRows,
                    ],
                ],
                [
                    'key' => 'available',
                    'label' => 'Beds free',
                    'value' => $availableBeds,
                    'meta' => "{$occupancy}% occupied",
                    'tone' => 'green',
                    'detail' => [
                        'title' => 'Beds',
                        'columns' => ['Bed', 'Room', 'Status'],
                        'filter_column' => 'Status',
                        'rows' => $bedRows,
                    ],
                ],
                [
                    'key' => 'admissions',
                    'label' => 'Admissions',
                    'value' => $admissions,
                    'meta' => "Discharges {$discharges}",
                    'tone' => 'purple',
                    'detail' => [
                        'title' => 'Admissions in range',
                        'columns' => ['Code', 'Patient', 'Bed', 'Status', 'Admitted'],
                        'filter_column' => 'Status',
                        'rows' => $admissionDetailRows,
                    ],
                ],
            ],
            'charts' => [
                [
                    'id' => 'beds',
                    'title' => 'Bed status',
                    'type' => 'bar',
                    'series' => [
                        ['label' => 'Occupied', 'value' => $occupiedBeds],
                        ['label' => 'Available', 'value' => $availableBeds],
                        ['label' => 'Other', 'value' => max(0, $totalBeds - $occupiedBeds - $availableBeds)],
                    ],
                ],
                [
                    'id' => 'flow',
                    'title' => 'Admissions trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(Admission::query(), 'admitted_at', $from, $to),
                ],
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
            ->with('creator:id,name')
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
                $m->creator?->name ?: '—',
                $status,
            ];
        })->values()->all();

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
                        'columns' => ['Code', 'Name', 'Qty', 'Reorder', 'Recorded by', 'Status'],
                        'filter_column' => 'Status',
                        'staff_filter_column' => 'Recorded by',
                        'rows' => $medicineDetailRows,
                    ],
                ],
                [
                    'key' => 'healthy',
                    'label' => 'Healthy stock',
                    'value' => $healthyPct,
                    'suffix' => '%',
                    'meta' => "{$healthy} above reorder",
                    'tone' => 'green',
                    'detail' => [
                        'title' => 'Medicines',
                        'columns' => ['Code', 'Name', 'Qty', 'Reorder', 'Recorded by', 'Status'],
                        'filter_column' => 'Status',
                        'staff_filter_column' => 'Recorded by',
                        'rows' => $medicineDetailRows,
                    ],
                ],
                [
                    'key' => 'low',
                    'label' => 'Low stock items',
                    'value' => $low,
                    'meta' => 'At / below reorder',
                    'tone' => 'orange',
                    'detail' => [
                        'title' => 'Stock alerts',
                        'columns' => ['Code', 'Name', 'Qty', 'Reorder', 'Recorded by', 'Status'],
                        'filter_column' => 'Status',
                        'staff_filter_column' => 'Recorded by',
                        'rows' => array_values(array_filter($medicineDetailRows, fn ($r) => in_array($r[5], ['Low', 'Critical'], true))),
                    ],
                ],
                [
                    'key' => 'critical',
                    'label' => 'Critical (zero)',
                    'value' => $critical,
                    'meta' => 'Out of stock',
                    'tone' => 'red',
                    'detail' => [
                        'title' => 'Critical medicines',
                        'columns' => ['Code', 'Name', 'Qty', 'Reorder', 'Recorded by', 'Status'],
                        'filter_column' => 'Status',
                        'staff_filter_column' => 'Recorded by',
                        'rows' => array_values(array_filter($medicineDetailRows, fn ($r) => $r[5] === 'Critical')),
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
                        'filter_column' => 'Recorded by',
                        'staff_filter_column' => 'Recorded by',
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
                        'filter_column' => 'Recorded by',
                        'staff_filter_column' => 'Recorded by',
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

        $stockIn = (float) (clone $moveBase)->where('type', 'in')->sum('quantity');
        $stockOut = (float) (clone $moveBase)->where('type', 'out')->sum('quantity');
        $movesIn = (clone $moveBase)->where('type', 'in')->count();
        $movesOut = (clone $moveBase)->where('type', 'out')->count();
        $moves = (clone $moveBase)->count();

        $itemQuery = InventoryItem::query()->where('status', 'active');
        if ($createdBy) {
            $itemQuery->where('created_by', $createdBy);
        }
        $low = (clone $itemQuery)->whereColumn('stock_qty', '<=', 'reorder_level')->count();
        $activeItems = (clone $itemQuery)->count();
        $peopleOut = (int) (clone $moveBase)
            ->where('type', 'out')
            ->whereNotNull('issued_to')
            ->where('issued_to', '!=', '')
            ->selectRaw('COUNT(DISTINCT issued_to) as c')
            ->value('c');

        $items = (clone $itemQuery)
            ->with('creator:id,name')
            ->orderBy('name')
            ->limit(200)
            ->get();

        $moveRows = InventoryMovement::query()
            ->with(['item:id,name,item_code,unit', 'creator:id,name'])
            ->whereBetween('moved_at', [$from, $to])
            ->when($createdBy, fn ($q) => $q->where('created_by', $createdBy))
            ->latest('moved_at')
            ->limit(300)
            ->get();

        $itemRows = $items->map(function (InventoryItem $i) {
            $status = (float) $i->stock_qty <= 0
                ? 'Critical'
                : ((float) $i->stock_qty <= (float) $i->reorder_level ? 'Low' : 'Good');

            return [
                $i->item_code,
                $i->name,
                $i->category ?: '—',
                $this->qtyLabel((float) $i->stock_qty, $i->unit),
                (string) $i->reorder_level,
                $i->creator?->name ?: '—',
                $status,
            ];
        })->values()->all();

        $movementDetail = $this->inventoryMovementDetail($moveRows);
        $inDetail = $this->inventoryMovementDetail($moveRows->where('type', 'in')->values());
        $outDetail = $this->inventoryMovementDetail($moveRows->where('type', 'out')->values());

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
                        'columns' => ['Code', 'Name', 'Category', 'Qty', 'Reorder', 'Recorded by', 'Status'],
                        'filter_column' => 'Status',
                        'staff_filter_column' => 'Recorded by',
                        'rows' => $itemRows,
                    ],
                ],
                [
                    'key' => 'in',
                    'label' => 'Stock IN qty',
                    'value' => $stockIn,
                    'meta' => "{$movesIn} entries",
                    'tone' => 'green',
                    'detail' => $inDetail,
                ],
                [
                    'key' => 'out',
                    'label' => 'Stock OUT qty',
                    'value' => $stockOut,
                    'meta' => "{$movesOut} entries · {$peopleOut} people",
                    'tone' => 'orange',
                    'detail' => $outDetail,
                ],
                [
                    'key' => 'moves',
                    'label' => 'All movements',
                    'value' => $moves,
                    'meta' => 'Selected range',
                    'tone' => 'purple',
                    'detail' => $movementDetail,
                ],
                [
                    'key' => 'low',
                    'label' => 'Low items',
                    'value' => $low,
                    'meta' => 'Needs restock',
                    'tone' => 'red',
                    'detail' => [
                        'title' => 'Low / critical stock',
                        'columns' => ['Code', 'Name', 'Category', 'Qty', 'Reorder', 'Recorded by', 'Status'],
                        'filter_column' => 'Status',
                        'staff_filter_column' => 'Recorded by',
                        'rows' => array_values(array_filter($itemRows, fn ($r) => in_array($r[6], ['Low', 'Critical'], true))),
                    ],
                ],
                [
                    'key' => 'users',
                    'label' => 'People issued',
                    'value' => $peopleOut,
                    'meta' => 'Stock OUT users',
                    'tone' => 'blue',
                    'detail' => $outDetail,
                ],
            ],
            'charts' => [
                [
                    'id' => 'out',
                    'title' => 'Stock OUT trend',
                    'type' => 'bar',
                    'series' => $this->sumSeries($outTrend, 'moved_at', 'quantity', $from, $to),
                ],
                [
                    'id' => 'in',
                    'title' => 'Stock IN trend',
                    'type' => 'bar',
                    'series' => $this->sumSeries($inTrend, 'moved_at', 'quantity', $from, $to),
                ],
            ],
        ];
    }

    private function adminVisitorsSection(Carbon $from, Carbon $to): array
    {
        $visitors = VisitorLog::query()->whereBetween('check_in_at', [$from, $to])->count();
        $checkedIn = VisitorLog::query()->where('status', 'checked_in')->count();
        $checkedOut = VisitorLog::query()
            ->whereBetween('check_in_at', [$from, $to])
            ->where('status', 'checked_out')
            ->count();
        $partySize = (int) VisitorLog::query()->whereBetween('check_in_at', [$from, $to])->sum('party_size');

        $rows = VisitorLog::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->whereBetween('check_in_at', [$from, $to])
            ->latest('check_in_at')
            ->limit(200)
            ->get();

        $inside = VisitorLog::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->where('status', 'checked_in')
            ->latest('check_in_at')
            ->limit(100)
            ->get();

        $logRows = $rows->map(function (VisitorLog $v) {
            $patient = trim(($v->patient?->first_name ?? '').' '.($v->patient?->last_name ?? ''));

            return [
                $v->visitor_name,
                $patient !== '' ? $patient : ($v->patient?->patient_code ?: '—'),
                (string) ($v->party_size ?? 1),
                $v->status,
                optional($v->check_in_at)->toDateString() ?: '—',
            ];
        })->values()->all();

        $insideRows = $inside->map(function (VisitorLog $v) {
            $patient = trim(($v->patient?->first_name ?? '').' '.($v->patient?->last_name ?? ''));

            return [
                $v->visitor_name,
                $patient !== '' ? $patient : ($v->patient?->patient_code ?: '—'),
                (string) ($v->party_size ?? 1),
                optional($v->check_in_at)->toDateTimeString() ?: '—',
            ];
        })->values()->all();

        return [
            'title' => 'Visitors overview',
            'card_mode' => 'modal',
            'kpis' => [
                [
                    'key' => 'visitors',
                    'label' => 'Visitors logged',
                    'value' => $visitors,
                    'meta' => "Checked out {$checkedOut}",
                    'tone' => 'blue',
                    'detail' => [
                        'title' => 'Visitor logs',
                        'columns' => ['Visitor', 'Patient', 'Party', 'Status', 'Check-in'],
                        'filter_column' => 'Status',
                        'rows' => $logRows,
                    ],
                ],
                [
                    'key' => 'inside',
                    'label' => 'Currently inside',
                    'value' => $checkedIn,
                    'meta' => 'Checked in now',
                    'tone' => 'orange',
                    'detail' => [
                        'title' => 'Currently inside',
                        'columns' => ['Visitor', 'Patient', 'Party', 'Check-in'],
                        'filter_column' => 'Visitor',
                        'rows' => $insideRows,
                    ],
                ],
                [
                    'key' => 'party',
                    'label' => 'Total party size',
                    'value' => $partySize,
                    'meta' => 'Selected range',
                    'tone' => 'green',
                    'detail' => [
                        'title' => 'Visitor logs',
                        'columns' => ['Visitor', 'Patient', 'Party', 'Status', 'Check-in'],
                        'filter_column' => 'Status',
                        'rows' => $logRows,
                    ],
                ],
            ],
            'charts' => [
                [
                    'id' => 'visitors',
                    'title' => 'Visitors trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(VisitorLog::query(), 'check_in_at', $from, $to),
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
        $expense = (float) AccountEntry::query()
            ->where('status', 'posted')
            ->where('type', 'expense')
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');
        $income = (float) AccountEntry::query()
            ->where('status', 'posted')
            ->where('type', 'income')
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $invoices = Invoice::query()
            ->with('patient:id,first_name,last_name')
            ->latest('id')
            ->limit(100)
            ->get();

        $payments = Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->latest('paid_at')
            ->limit(100)
            ->get();

        $invoiceRows = $invoices->map(function (Invoice $inv) {
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
                        'title' => 'Invoices',
                        'columns' => ['Invoice', 'Patient', 'Total', 'Balance', 'Status'],
                        'filter_column' => 'Status',
                        'rows' => $invoiceRows,
                    ],
                ],
                [
                    'key' => 'income',
                    'label' => 'Ledger income',
                    'value' => $income,
                    'money' => true,
                    'meta' => 'Selected range',
                    'tone' => 'blue',
                    'detail' => [
                        'title' => 'Invoices',
                        'columns' => ['Invoice', 'Patient', 'Total', 'Balance', 'Status'],
                        'filter_column' => 'Status',
                        'rows' => $invoiceRows,
                    ],
                ],
                [
                    'key' => 'expense',
                    'label' => 'Expenses',
                    'value' => $expense,
                    'money' => true,
                    'meta' => 'Selected range',
                    'tone' => 'purple',
                    'detail' => [
                        'title' => 'Payments in range',
                        'columns' => ['Code', 'Amount', 'Method', 'Paid at'],
                        'filter_column' => 'Method',
                        'rows' => $paymentRows,
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
            ],
        ];
    }

    private function adminStaffSection(Carbon $from, Carbon $to): array
    {
        $active = User::query()->where('is_active', true)->count();
        $total = User::query()->count();
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
            'pharmacist',
            'inventory-manager',
        ];
        $roleTones = [
            'receptionist' => 'blue',
            'gatekeeper' => 'orange',
            'doctor' => 'green',
            'nurse' => 'purple',
            'finance' => 'green',
            'pharmacist' => 'orange',
            'inventory-manager' => 'red',
        ];
        $roleLabels = [
            'receptionist' => 'Receptionists',
            'gatekeeper' => 'Gatekeepers',
            'doctor' => 'Doctors',
            'nurse' => 'Nurses',
            'finance' => 'Finance staff',
            'pharmacist' => 'Pharmacists',
            'inventory-manager' => 'Inventory managers',
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

        $detailBase = [
            'columns' => ['Name', 'Email', 'Role', 'Code', 'Status'],
            'filter_column' => 'Role',
        ];

        $kpis = [
            [
                'key' => 'total',
                'label' => 'Total staff',
                'value' => $total,
                'meta' => "Active {$active}",
                'tone' => 'blue',
                'detail' => array_merge($detailBase, [
                    'title' => 'All staff',
                    'rows' => $staffRows,
                ]),
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
            'charts' => [
                [
                    'id' => 'staff-by-role',
                    'title' => 'Staff by role',
                    'type' => 'bar',
                    'series' => $roles->map(fn ($r) => [
                        'label' => $r->name,
                        'value' => (int) ($roleCounts[$r->id] ?? 0),
                    ])->values()->all(),
                ],
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
                ['key' => 'total', 'label' => 'Total patients', 'value' => $totalPatients, 'meta' => "{$admittedPatients} admitted", 'tone' => 'blue'],
                ['key' => 'registered', 'label' => 'New registrations', 'value' => $registered, 'meta' => 'Selected range', 'tone' => 'orange'],
                ['key' => 'admissions', 'label' => 'Admissions', 'value' => $admissions, 'meta' => "{$active} active stays", 'tone' => 'purple'],
                ['key' => 'beds', 'label' => 'Beds free', 'value' => $availableBeds, 'meta' => "{$occupiedBeds} occupied · of {$totalBeds}", 'tone' => 'green'],
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
            'links' => [
                ['to' => '/app/registration', 'label' => 'Register patient'],
                ['to' => '/app/admission', 'label' => 'Admit patient'],
                ['to' => '/app/beds', 'label' => 'Beds'],
                ['to' => '/app/patients', 'label' => 'Patients'],
            ],
            'alerts' => $availableBeds === 0
                ? [['title' => 'No beds free', 'detail' => 'All beds are occupied', 'level' => 'warning']]
                : [['title' => 'Reception ready', 'detail' => "{$availableBeds} bed(s) available", 'level' => 'success']],
        ];
    }

    private function gatekeeperDashboard(Carbon $from, Carbon $to): array
    {
        $visitors = VisitorLog::query()->whereBetween('check_in_at', [$from, $to])->count();
        $checkedIn = VisitorLog::query()->where('status', 'checked_in')->count();
        $checkedOut = VisitorLog::query()
            ->whereBetween('check_in_at', [$from, $to])
            ->where('status', 'checked_out')
            ->count();
        $partySize = (int) VisitorLog::query()->whereBetween('check_in_at', [$from, $to])->sum('party_size');

        $rows = VisitorLog::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->whereBetween('check_in_at', [$from, $to])
            ->latest('check_in_at')
            ->limit(150)
            ->get();

        $inside = VisitorLog::query()
            ->with('patient:id,first_name,last_name,patient_code')
            ->where('status', 'checked_in')
            ->latest('check_in_at')
            ->limit(100)
            ->get();

        return [
            'title' => 'Gate dashboard',
            'kpis' => [
                ['key' => 'visitors', 'label' => 'Visitors logged', 'value' => $visitors, 'meta' => "Checked out {$checkedOut}", 'tone' => 'blue'],
                ['key' => 'checked_in', 'label' => 'Currently inside', 'value' => $checkedIn, 'meta' => 'Checked in now', 'tone' => 'orange'],
                ['key' => 'party', 'label' => 'Total party size', 'value' => $partySize, 'meta' => 'Selected range', 'tone' => 'green'],
            ],
            'charts' => [
                [
                    'id' => 'visitors',
                    'title' => 'Visitors trend',
                    'type' => 'bar',
                    'series' => $this->countSeries(VisitorLog::query(), 'check_in_at', $from, $to),
                ],
            ],
            'tables' => [
                [
                    'title' => 'Currently inside',
                    'total' => $inside->count(),
                    'columns' => ['Visitor', 'Patient', 'Party', 'Check-in'],
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
            'alerts' => [['title' => 'Gate desk', 'detail' => "{$checkedIn} visitor party(ies) still inside", 'level' => 'info']],
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
                ['key' => 'rounds', 'label' => 'Rounds', 'value' => $rounds, 'meta' => 'Selected range', 'tone' => 'blue'],
                ['key' => 'notes', 'label' => 'Nursing notes', 'value' => $notes, 'meta' => "Dispenses {$dispenses}", 'tone' => 'green'],
                ['key' => 'discharges', 'label' => 'Discharges', 'value' => $discharges, 'meta' => 'Selected range', 'tone' => 'purple'],
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
                ['key' => 'notes', 'label' => 'Nursing notes', 'value' => $notes, 'meta' => 'Selected range', 'tone' => 'blue'],
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
        $collection = (float) Payment::query()->whereBetween('paid_at', [$from, $to])->sum('amount');
        $payments = Payment::query()->whereBetween('paid_at', [$from, $to])->count();
        $outstanding = (float) Invoice::query()->whereIn('status', ['unpaid', 'partial'])->sum('balance');
        $open = Invoice::query()->whereIn('status', ['unpaid', 'partial'])->count();
        $income = (float) AccountEntry::query()
            ->where('status', 'posted')->where('type', 'income')
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');
        $expense = (float) AccountEntry::query()
            ->where('status', 'posted')->where('type', 'expense')
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $invoices = Invoice::query()
            ->with('patient:id,first_name,last_name')
            ->whereIn('status', ['unpaid', 'partial', 'paid'])
            ->latest('id')
            ->limit(150)
            ->get();

        $paymentRows = Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->latest('paid_at')
            ->limit(100)
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
                ['key' => 'collection', 'label' => 'Collection', 'value' => $collection, 'money' => true, 'meta' => "{$payments} payment(s)", 'tone' => 'green'],
                ['key' => 'outstanding', 'label' => 'Outstanding', 'value' => $outstanding, 'money' => true, 'meta' => "{$open} invoice(s)", 'tone' => 'orange'],
                ['key' => 'income', 'label' => 'Ledger income', 'value' => $income, 'money' => true, 'meta' => 'Selected range', 'tone' => 'blue'],
                ['key' => 'expense', 'label' => 'Ledger expense', 'value' => $expense, 'money' => true, 'meta' => 'Selected range', 'tone' => 'purple'],
            ],
            'charts' => [
                [
                    'id' => 'collection',
                    'title' => 'Collection trend (PKR)',
                    'type' => 'bar',
                    'series' => $this->sumSeries(Payment::query(), 'paid_at', 'amount', $from, $to),
                ],
            ],
            'tables' => [
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
                    'title' => 'Payments in range',
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
                ? [['title' => 'Fees due', 'detail' => "{$open} unpaid/partial invoice(s)", 'level' => 'warning']]
                : [['title' => 'Fees clear', 'detail' => 'No open invoices', 'level' => 'success']],
        ];
    }

    private function pharmacistDashboard(Carbon $from, Carbon $to): array
    {
        $dispenses = MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to])->count();
        $qty = (float) MedicineDispense::query()->whereBetween('dispensed_at', [$from, $to])->sum('quantity');
        $low = Medicine::query()->where('status', 'active')->whereColumn('stock_qty', '<=', 'reorder_level')->count();
        $activeMeds = Medicine::query()->where('status', 'active')->count();
        $invLow = InventoryItem::query()->where('status', 'active')->whereColumn('stock_qty', '<=', 'reorder_level')->count();

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
            'title' => 'Pharmacy dashboard',
            'kpis' => [
                ['key' => 'dispenses', 'label' => 'Dispenses', 'value' => $dispenses, 'meta' => 'Selected range', 'tone' => 'blue'],
                ['key' => 'qty', 'label' => 'Qty dispensed', 'value' => $qty, 'meta' => 'Selected range', 'tone' => 'green'],
                ['key' => 'low', 'label' => 'Low medicine', 'value' => $low, 'meta' => "of {$activeMeds} · inv low {$invLow}", 'tone' => 'orange'],
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

    private function inventoryDashboard(Carbon $from, Carbon $to): array
    {
        return array_merge($this->adminInventorySection($from, $to), [
            'title' => 'Inventory dashboard',
            'links' => [
                ['to' => '/app/inventory', 'label' => 'Stock in / out'],
                ['to' => '/app/kitchen', 'label' => 'Kitchen stock'],
            ],
        ]);
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

    private function inventoryMovementDetail($moveRows): array
    {
        return [
            'title' => 'Stock movements',
            'columns' => ['Code', 'Item', 'Type', 'Qty', 'Purpose', 'Person', 'Dept', 'Used for', 'Recorded by', 'Date'],
            'filter_column' => 'Type',
            'staff_filter_column' => 'Recorded by',
            'rows' => collect($moveRows)->map(function (InventoryMovement $m) {
                $unit = $m->unit ?: ($m->item?->unit ?: '');

                return [
                    $m->movement_code ?? ('#'.$m->id),
                    $m->item?->name ?: ($m->item?->item_code ?: '—'),
                    $m->type,
                    $this->qtyLabel((float) $m->quantity, $unit),
                    $m->purpose ? str_replace('_', ' ', $m->purpose) : '—',
                    $m->issued_to ?: '—',
                    $m->department ? str_replace('_', ' ', $m->department) : '—',
                    $m->used_for ?: '—',
                    $m->creator?->name ?: '—',
                    optional($m->moved_at)->toDateTimeString() ?: '—',
                ];
            })->values()->all(),
        ];
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
            $alerts[] = ['title' => 'Fee outstanding', 'detail' => "{$openInvoices} invoice(s) unpaid/partial", 'level' => 'info'];
        }
        if ($alerts === []) {
            $alerts[] = ['title' => 'All clear', 'detail' => 'No critical alerts right now', 'level' => 'success'];
        }

        return $alerts;
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

    private function sumSeries($query, string $column, string $sumColumn, Carbon $from, Carbon $to): array
    {
        if ($from->diffInDays($to) > 45) {
            $rows = (clone $query)
                ->selectRaw('DATE_FORMAT('.$column.', "%Y-%m") as d, COALESCE(SUM('.$sumColumn.'),0) as c')
                ->whereBetween($column, [$from, $to])
                ->groupBy('d')
                ->pluck('c', 'd');

            return $this->fillMonthlySeries($from, $to, $rows);
        }

        $rows = (clone $query)
            ->selectRaw('DATE('.$column.') as d, COALESCE(SUM('.$sumColumn.'),0) as c')
            ->whereBetween($column, [$from, $to])
            ->groupBy('d')
            ->pluck('c', 'd');

        return $this->fillDailySeries($from, $to, $rows);
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
