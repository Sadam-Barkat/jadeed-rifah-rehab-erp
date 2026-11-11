<?php

use App\Http\Controllers\Api\AccountEntryController;
use App\Http\Controllers\Api\AdmissionController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AssetMaintenanceController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BedController;
use App\Http\Controllers\Api\DischargeController;
use App\Http\Controllers\Api\DoctorController;
use App\Http\Controllers\Api\DoctorRoundController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\FeePackageController;
use App\Http\Controllers\Api\CanteenController;
use App\Http\Controllers\Api\ComplaintController;
use App\Http\Controllers\Api\ComplianceCheckController;
use App\Http\Controllers\Api\ComplianceItemController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\InventoryItemController;
use App\Http\Controllers\Api\InventoryMovementController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\KitchenMenuController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\LabOrderController;
use App\Http\Controllers\Api\ManagementNoteController;
use App\Http\Controllers\Api\MedicalRecordController;
use App\Http\Controllers\Api\MedicineController;
use App\Http\Controllers\Api\MedicineDispenseController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\StaffTaskController;
use App\Http\Controllers\Api\NursingNoteController;
use App\Http\Controllers\Api\PatientController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\PsychologySessionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SecurityCameraController;
use App\Http\Controllers\Api\SecurityIncidentController;
use App\Http\Controllers\Api\SecurityShiftController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\TreatmentPlanController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VisitorLogController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{appNotification}/read', [NotificationController::class, 'markRead']);

    Route::middleware('module:registration,patients,admission')->group(function () {
        Route::get('/patients/check-duplicate', [PatientController::class, 'checkDuplicate']);
        Route::get('/patients', [PatientController::class, 'index']);
        Route::post('/patients', [PatientController::class, 'store']);
        Route::get('/patients/{patient}', [PatientController::class, 'show']);
        Route::put('/patients/{patient}', [PatientController::class, 'update']);
    });

    Route::middleware('module:beds,admission')->group(function () {
        Route::get('/beds', [BedController::class, 'index']);
        Route::get('/beds/available', [BedController::class, 'available']);
        Route::patch('/beds/{bed}/status', [BedController::class, 'updateStatus']);
    });

    Route::middleware('module:admission,patients,medical-records,nursing,treatment,discharge,pharmacy,lab,billing,psychology,visitors,doctors')->group(function () {
        Route::get('/admissions', [AdmissionController::class, 'index']);
        Route::get('/admissions/{admission}', [AdmissionController::class, 'show']);
    });

    Route::middleware('module:doctors,medical-records,patients')->group(function () {
        Route::get('/doctors', [DoctorController::class, 'index']);
        Route::post('/doctors', [DoctorController::class, 'store']);
        Route::get('/doctors/{doctor}', [DoctorController::class, 'show']);
        Route::put('/doctors/{doctor}', [DoctorController::class, 'update']);
        Route::get('/doctor-rounds', [DoctorRoundController::class, 'index']);
        Route::post('/doctor-rounds', [DoctorRoundController::class, 'store']);
        Route::get('/doctor-rounds/{doctorRound}', [DoctorRoundController::class, 'show']);
    });

    Route::middleware('module:admission,patients')->group(function () {
        Route::post('/admissions', [AdmissionController::class, 'store']);
    });

    Route::middleware('module:treatment,discharge,patients')->group(function () {
        Route::get('/treatment-plans', [TreatmentPlanController::class, 'index']);
        Route::post('/treatment-plans', [TreatmentPlanController::class, 'store']);
        Route::get('/treatment-plans/{treatmentPlan}', [TreatmentPlanController::class, 'show']);
        Route::put('/treatment-plans/{treatmentPlan}', [TreatmentPlanController::class, 'update']);
    });

    Route::middleware('module:discharge,admission,patients')->group(function () {
        Route::get('/discharges', [DischargeController::class, 'index']);
        Route::post('/discharges', [DischargeController::class, 'store']);
        Route::get('/discharges/{discharge}', [DischargeController::class, 'show']);
    });

    Route::middleware('module:medical-records,nursing,patients')->group(function () {
        Route::get('/medical-records', [MedicalRecordController::class, 'index']);
        Route::post('/medical-records', [MedicalRecordController::class, 'store']);
        Route::get('/medical-records/{medicalRecord}', [MedicalRecordController::class, 'show']);
        Route::put('/medical-records/{medicalRecord}', [MedicalRecordController::class, 'update']);
    });

    Route::middleware('module:nursing,medical-records,patients')->group(function () {
        Route::get('/nursing-notes', [NursingNoteController::class, 'index']);
        Route::post('/nursing-notes', [NursingNoteController::class, 'store']);
        Route::get('/nursing-notes/{nursingNote}', [NursingNoteController::class, 'show']);
    });

    Route::middleware('module:pharmacy,nursing,patients')->group(function () {
        Route::get('/medicines', [MedicineController::class, 'index']);
        Route::post('/medicines', [MedicineController::class, 'store']);
        Route::put('/medicines/{medicine}', [MedicineController::class, 'update']);
        Route::get('/medicine-dispenses', [MedicineDispenseController::class, 'index']);
        Route::post('/medicine-dispenses', [MedicineDispenseController::class, 'store']);
    });

    Route::middleware('module:lab,medical-records,patients')->group(function () {
        Route::get('/lab-orders', [LabOrderController::class, 'index']);
        Route::post('/lab-orders', [LabOrderController::class, 'store']);
        Route::get('/lab-orders/{labOrder}', [LabOrderController::class, 'show']);
        Route::put('/lab-orders/{labOrder}', [LabOrderController::class, 'update']);
    });

    Route::middleware('module:billing,accounts')->group(function () {
        Route::get('/fee-packages', [FeePackageController::class, 'index']);
        Route::post('/fee-packages', [FeePackageController::class, 'store']);
        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::post('/invoices', [InvoiceController::class, 'store']);
        Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
        Route::get('/payments', [PaymentController::class, 'index']);
        Route::post('/payments', [PaymentController::class, 'store']);
    });

    Route::middleware('module:psychology,patients,treatment')->group(function () {
        Route::get('/psychology-sessions', [PsychologySessionController::class, 'index']);
        Route::post('/psychology-sessions', [PsychologySessionController::class, 'store']);
        Route::get('/psychology-sessions/{psychologySession}', [PsychologySessionController::class, 'show']);
    });

    Route::middleware('module:visitors,security,patients')->group(function () {
        Route::get('/visitor-logs', [VisitorLogController::class, 'index']);
        Route::post('/visitor-logs', [VisitorLogController::class, 'store']);
        Route::get('/visitor-logs/{visitorLog}', [VisitorLogController::class, 'show']);
        Route::put('/visitor-logs/{visitorLog}', [VisitorLogController::class, 'update']);
    });

    Route::middleware('module:hr,attendance,payroll')->group(function () {
        Route::get('/employees', [EmployeeController::class, 'index']);
        Route::post('/employees', [EmployeeController::class, 'store']);
        Route::get('/employees/{employee}', [EmployeeController::class, 'show']);
        Route::put('/employees/{employee}', [EmployeeController::class, 'update']);
    });

    Route::middleware('module:attendance,hr,payroll')->group(function () {
        Route::get('/attendances', [AttendanceController::class, 'index']);
        Route::post('/attendances', [AttendanceController::class, 'store']);
    });

    Route::middleware('module:payroll,hr')->group(function () {
        Route::get('/payroll-runs', [PayrollController::class, 'indexRuns']);
        Route::post('/payroll-runs', [PayrollController::class, 'generate']);
        Route::post('/payroll-runs/{payrollRun}/finalize', [PayrollController::class, 'finalize']);
        Route::get('/payroll-items', [PayrollController::class, 'indexItems']);
        Route::post('/payroll-items/{payrollItem}/pay', [PayrollController::class, 'markPaid']);
    });

    Route::middleware('module:inventory,kitchen,purchase,pharmacy')->group(function () {
        Route::get('/inventory-items', [InventoryItemController::class, 'index']);
        Route::post('/inventory-items', [InventoryItemController::class, 'store']);
        Route::put('/inventory-items/{inventoryItem}', [InventoryItemController::class, 'update']);
        Route::get('/inventory-movements', [InventoryMovementController::class, 'index']);
        Route::post('/inventory-movements', [InventoryMovementController::class, 'store']);
    });

    Route::middleware('module:kitchen,canteen,inventory')->group(function () {
        Route::get('/kitchen-menus', [KitchenMenuController::class, 'index']);
        Route::post('/kitchen-menus', [KitchenMenuController::class, 'store']);
        Route::put('/kitchen-menus/{kitchenMenu}', [KitchenMenuController::class, 'update']);
    });

    Route::middleware('module:purchase,inventory,accounts')->group(function () {
        Route::get('/suppliers', [SupplierController::class, 'index']);
        Route::post('/suppliers', [SupplierController::class, 'store']);
        Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
        Route::post('/purchase-orders', [PurchaseOrderController::class, 'store']);
        Route::post('/purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive']);
    });

    Route::middleware('module:canteen,kitchen')->group(function () {
        Route::get('/canteen-products', [CanteenController::class, 'products']);
        Route::post('/canteen-products', [CanteenController::class, 'storeProduct']);
        Route::get('/canteen-sales', [CanteenController::class, 'sales']);
        Route::post('/canteen-sales', [CanteenController::class, 'storeSale']);
    });

    Route::middleware('module:documents')->group(function () {
        Route::get('/documents', [DocumentController::class, 'index']);
        Route::post('/documents', [DocumentController::class, 'store']);
        Route::post('/documents/{document}/archive', [DocumentController::class, 'archive']);
    });

    Route::middleware('module:complaints,security')->group(function () {
        Route::get('/complaints', [ComplaintController::class, 'index']);
        Route::post('/complaints', [ComplaintController::class, 'store']);
        Route::put('/complaints/{complaint}', [ComplaintController::class, 'update']);
    });

    Route::middleware('module:assets,general-management')->group(function () {
        Route::get('/assets', [AssetController::class, 'index']);
        Route::post('/assets', [AssetController::class, 'store']);
        Route::put('/assets/{asset}', [AssetController::class, 'update']);
        Route::get('/asset-maintenances', [AssetMaintenanceController::class, 'index']);
        Route::post('/asset-maintenances', [AssetMaintenanceController::class, 'store']);
        Route::post('/asset-maintenances/{assetMaintenance}/complete', [AssetMaintenanceController::class, 'complete']);
    });

    Route::middleware('module:accounts,billing')->group(function () {
        Route::get('/account-entries', [AccountEntryController::class, 'index']);
        Route::post('/account-entries', [AccountEntryController::class, 'store']);
        Route::post('/account-entries/{accountEntry}/void', [AccountEntryController::class, 'void']);
    });

    Route::middleware('module:users,hr,notifications,tasks,general-management')->group(function () {
        Route::get('/roles', [UserController::class, 'roles']);
        Route::get('/users', [UserController::class, 'index']);
    });

    Route::middleware('module:users,hr')->group(function () {
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
    });

    Route::middleware('module:notifications,users')->group(function () {
        Route::post('/notifications', [NotificationController::class, 'store']);
    });

    Route::middleware('module:tasks,general-management')->group(function () {
        Route::get('/staff-tasks', [StaffTaskController::class, 'index']);
        Route::post('/staff-tasks', [StaffTaskController::class, 'store']);
        Route::put('/staff-tasks/{staffTask}', [StaffTaskController::class, 'update']);
    });

    Route::middleware('module:general-management,tasks,ceo-control')->group(function () {
        Route::get('/management-notes', [ManagementNoteController::class, 'index']);
        Route::post('/management-notes', [ManagementNoteController::class, 'store']);
        Route::post('/management-notes/{managementNote}/archive', [ManagementNoteController::class, 'archive']);
    });

    Route::middleware('module:reports,ceo-control,owner-dashboard')->group(function () {
        Route::get('/reports/overview', [ReportController::class, 'overview']);
    });

    Route::middleware('module:compliance,documents,complaints')->group(function () {
        Route::get('/compliance-items', [ComplianceItemController::class, 'index']);
        Route::post('/compliance-items', [ComplianceItemController::class, 'store']);
        Route::put('/compliance-items/{complianceItem}', [ComplianceItemController::class, 'update']);
        Route::get('/compliance-checks', [ComplianceCheckController::class, 'index']);
        Route::post('/compliance-checks', [ComplianceCheckController::class, 'store']);
        Route::put('/compliance-checks/{complianceCheck}', [ComplianceCheckController::class, 'update']);
    });

    Route::middleware('module:security,visitors')->group(function () {
        Route::get('/security-cameras', [SecurityCameraController::class, 'index']);
        Route::post('/security-cameras', [SecurityCameraController::class, 'store']);
        Route::put('/security-cameras/{securityCamera}', [SecurityCameraController::class, 'update']);
        Route::get('/security-incidents', [SecurityIncidentController::class, 'index']);
        Route::post('/security-incidents', [SecurityIncidentController::class, 'store']);
        Route::put('/security-incidents/{securityIncident}', [SecurityIncidentController::class, 'update']);
        Route::get('/security-shifts', [SecurityShiftController::class, 'index']);
        Route::post('/security-shifts', [SecurityShiftController::class, 'store']);
        Route::put('/security-shifts/{securityShift}', [SecurityShiftController::class, 'update']);
    });

    Route::middleware('module:settings,users,ceo-control')->group(function () {
        Route::get('/settings/facility', [SettingController::class, 'showFacility']);
        Route::put('/settings/facility', [SettingController::class, 'updateFacility']);
        Route::get('/settings/backups', [SettingController::class, 'indexBackups']);
        Route::post('/settings/backups', [SettingController::class, 'storeBackup']);
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
    });
});
