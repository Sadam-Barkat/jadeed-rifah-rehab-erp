<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountEntry;
use App\Models\Admission;
use App\Models\Bed;
use App\Models\Complaint;
use App\Models\Employee;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\StaffTask;
use App\Models\VisitorLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $today = now()->toDateString();

        $totalBeds = Bed::query()->count();
        $occupiedBeds = Bed::query()->where('status', 'occupied')->count();
        $availableBeds = Bed::query()->where('status', 'available')->count();
        $activeAdmissions = Admission::query()->where('status', 'active')->count();
        $admittedPatients = Patient::query()->where('status', 'admitted')->count();

        $occupancy = $totalBeds > 0
            ? round(($occupiedBeds / $totalBeds) * 100, 1)
            : 0;

        $todayCollection = (float) Payment::query()
            ->whereDate('paid_at', $today)
            ->sum('amount');

        $outstandingFees = (float) Invoice::query()
            ->whereIn('status', ['unpaid', 'partial'])
            ->sum('balance');

        $openInvoices = Invoice::query()
            ->whereIn('status', ['unpaid', 'partial'])
            ->count();

        $income = (float) AccountEntry::query()->where('status', 'posted')->where('type', 'income')->sum('amount');
        $expense = (float) AccountEntry::query()->where('status', 'posted')->where('type', 'expense')->sum('amount');

        $pendingTasks = StaffTask::query()->whereIn('status', ['pending', 'in_progress'])->count();
        $openComplaints = Complaint::query()->whereIn('status', ['open', 'in_progress'])->count();
        $activeEmployees = Employee::query()->where('status', 'active')->count();
        $todayVisitors = VisitorLog::query()->whereDate('check_in_at', $today)->count();

        $lowMedicines = Medicine::query()
            ->where('status', 'active')
            ->whereColumn('stock_qty', '<=', 'reorder_level')
            ->count();

        $lowInventory = InventoryItem::query()
            ->where('status', 'active')
            ->whereColumn('stock_qty', '<=', 'reorder_level')
            ->count();

        $alerts = [];

        if ($lowMedicines > 0) {
            $alerts[] = [
                'title' => 'Low medicine stock',
                'detail' => "{$lowMedicines} medicine(s) at or below reorder level",
                'level' => 'warning',
            ];
        }

        if ($lowInventory > 0) {
            $alerts[] = [
                'title' => 'Low inventory stock',
                'detail' => "{$lowInventory} inventory item(s) need restock",
                'level' => 'warning',
            ];
        }

        if ($openInvoices > 0) {
            $alerts[] = [
                'title' => 'Fee outstanding',
                'detail' => "{$openInvoices} invoice(s) unpaid/partial",
                'level' => 'info',
            ];
        }

        if ($pendingTasks > 0) {
            $alerts[] = [
                'title' => 'Open tasks',
                'detail' => "{$pendingTasks} task(s) pending or in progress",
                'level' => 'info',
            ];
        }

        if ($openComplaints > 0) {
            $alerts[] = [
                'title' => 'Open complaints',
                'detail' => "{$openComplaints} complaint/incident(s) open",
                'level' => 'danger',
            ];
        }

        if ($alerts === []) {
            $alerts[] = [
                'title' => 'All clear',
                'detail' => 'No critical alerts right now',
                'level' => 'success',
            ];
        }

        return response()->json([
            'data' => [
                'patients' => [
                    'admitted' => $admittedPatients,
                    'active_admissions' => $activeAdmissions,
                    'total_registered' => Patient::query()->count(),
                ],
                'beds' => [
                    'total' => $totalBeds,
                    'occupied' => $occupiedBeds,
                    'available' => $availableBeds,
                    'occupancy_percent' => $occupancy,
                ],
                'finance' => [
                    'today_collection' => $todayCollection,
                    'outstanding_fees' => $outstandingFees,
                    'open_invoices' => $openInvoices,
                    'ledger_income' => $income,
                    'ledger_expense' => $expense,
                    'ledger_balance' => round($income - $expense, 2),
                ],
                'operations' => [
                    'pending_tasks' => $pendingTasks,
                    'open_complaints' => $openComplaints,
                    'active_employees' => $activeEmployees,
                    'today_visitors' => $todayVisitors,
                    'low_medicines' => $lowMedicines,
                    'low_inventory' => $lowInventory,
                ],
                'alerts' => $alerts,
                'generated_at' => now()->toDateTimeString(),
            ],
        ]);
    }
}
