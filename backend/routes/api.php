<?php

use App\Http\Controllers\Api\AccountEntryController;
use App\Http\Controllers\Api\AdmissionController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BedController;
use App\Http\Controllers\Api\DischargeController;
use App\Http\Controllers\Api\DoctorController;
use App\Http\Controllers\Api\DoctorRoundController;
use App\Http\Controllers\Api\FeePackageController;
use App\Http\Controllers\Api\InventoryItemController;
use App\Http\Controllers\Api\InventoryMovementController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\KitchenMenuController;
use App\Http\Controllers\Api\MedicalRecordController;
use App\Http\Controllers\Api\MedicineController;
use App\Http\Controllers\Api\MedicineDispenseController;
use App\Http\Controllers\Api\MedicineMovementController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NursingNoteController;
use App\Http\Controllers\Api\PatientController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\TreatmentPlanController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VisitorLogController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me/account', [AuthController::class, 'updateAccount']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

    Route::middleware('module:registration,patients,admission')->group(function () {
        Route::get('/patients/check-duplicate', [PatientController::class, 'checkDuplicate']);
        Route::get('/patients', [PatientController::class, 'index']);
        Route::post('/patients', [PatientController::class, 'store']);
        Route::get('/patients/{patient}', [PatientController::class, 'show']);
        Route::put('/patients/{patient}', [PatientController::class, 'update']);
    });

    Route::middleware(['module:patients,registration', 'admin'])->group(function () {
        Route::delete('/patients/{patient}', [PatientController::class, 'destroy']);
    });

    Route::middleware('module:beds,admission,patients')->group(function () {
        Route::get('/beds/available', [BedController::class, 'available']);
    });

    Route::middleware('module:beds,admission')->group(function () {
        Route::get('/beds', [BedController::class, 'index']);
        Route::patch('/beds/{bed}/status', [BedController::class, 'updateStatus']);
    });

    Route::middleware('module:admission,patients,medical-records,nursing,treatment,discharge,pharmacy,billing,visitors,doctors')->group(function () {
        Route::get('/admissions', [AdmissionController::class, 'index']);
        Route::get('/admissions/{admission}', [AdmissionController::class, 'show']);
    });

    Route::middleware('module:admission,patients')->group(function () {
        Route::post('/admissions', [AdmissionController::class, 'store']);
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

    Route::middleware('module:treatment,discharge,patients')->group(function () {
        Route::get('/treatment-plans', [TreatmentPlanController::class, 'index']);
        Route::post('/treatment-plans', [TreatmentPlanController::class, 'store']);
        Route::get('/treatment-plans/{treatmentPlan}', [TreatmentPlanController::class, 'show']);
        Route::put('/treatment-plans/{treatmentPlan}', [TreatmentPlanController::class, 'update']);
    });

    Route::middleware('module:discharge,admission,patients')->group(function () {
        Route::get('/discharges', [DischargeController::class, 'index']);
        Route::post('/discharges/request', [DischargeController::class, 'requestDischarge']);
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

    // Medicines are Pharmacy-only (not Inventory). Read access for clinical roles.
    Route::middleware('module:pharmacy,nursing,patients,doctors,medical-records')->group(function () {
        Route::get('/medicines', [MedicineController::class, 'index']);
        Route::get('/medicine-dispenses', [MedicineDispenseController::class, 'index']);
    });

    Route::middleware('module:pharmacy')->group(function () {
        Route::post('/medicines', [MedicineController::class, 'store']);
        Route::put('/medicines/{medicine}', [MedicineController::class, 'update']);
        Route::get('/medicine-movements', [MedicineMovementController::class, 'index']);
        Route::post('/medicine-movements', [MedicineMovementController::class, 'store']);
        Route::post('/medicine-dispenses', [MedicineDispenseController::class, 'store']);
    });

    Route::middleware('module:billing,accounts')->group(function () {
        Route::get('/fee-packages', [FeePackageController::class, 'index']);
        Route::post('/fee-packages', [FeePackageController::class, 'store']);
        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::post('/invoices', [InvoiceController::class, 'store']);
        Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
        Route::get('/payments', [PaymentController::class, 'index']);
        Route::post('/payments', [PaymentController::class, 'store']);
        Route::get('/payments/{payment}', [PaymentController::class, 'show']);
    });

    Route::middleware('admin')->group(function () {
        Route::post('/payments/{payment}/approve', [PaymentController::class, 'approve']);
        Route::post('/payments/{payment}/reject', [PaymentController::class, 'reject']);
    });

    Route::middleware('module:visitors,patients')->group(function () {
        Route::get('/visitor-logs', [VisitorLogController::class, 'index']);
        Route::post('/visitor-logs', [VisitorLogController::class, 'store']);
        Route::get('/visitor-logs/{visitorLog}', [VisitorLogController::class, 'show']);
        Route::put('/visitor-logs/{visitorLog}', [VisitorLogController::class, 'update']);
    });

    // Stock in/out is Inventory Manager only (not Admin / Doctor / Pharmacist).
    Route::middleware('module:inventory')->group(function () {
        Route::get('/inventory-items', [InventoryItemController::class, 'index']);
        Route::post('/inventory-items', [InventoryItemController::class, 'store']);
        Route::put('/inventory-items/{inventoryItem}', [InventoryItemController::class, 'update']);
        Route::get('/inventory-movements', [InventoryMovementController::class, 'index']);
        Route::post('/inventory-movements', [InventoryMovementController::class, 'store']);
        Route::get('/inventory-beds', [BedController::class, 'forInventory']);
    });

    Route::middleware('module:kitchen,inventory')->group(function () {
        Route::get('/kitchen-menus', [KitchenMenuController::class, 'index']);
        Route::post('/kitchen-menus', [KitchenMenuController::class, 'store']);
        Route::put('/kitchen-menus/{kitchenMenu}', [KitchenMenuController::class, 'update']);
    });

    Route::middleware('module:accounts,billing')->group(function () {
        Route::get('/account-entries', [AccountEntryController::class, 'index']);
        Route::post('/account-entries', [AccountEntryController::class, 'store']);
        Route::post('/account-entries/{accountEntry}/void', [AccountEntryController::class, 'void']);
    });

    Route::middleware('module:users')->group(function () {
        Route::get('/roles', [UserController::class, 'roles']);
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
    });

    Route::middleware(['module:users', 'admin'])->group(function () {
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
    });

    Route::get('/reports/filter-meta', [ReportController::class, 'filterMeta']);
    Route::get('/reports/stock-alerts', [ReportController::class, 'stockAlerts']);
    Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
    Route::middleware('module:reports,owner-dashboard')->group(function () {
        Route::get('/reports/overview', [ReportController::class, 'overview']);
    });

    Route::middleware('module:settings,users')->group(function () {
        Route::get('/settings/facility', [SettingController::class, 'showFacility']);
        Route::put('/settings/facility', [SettingController::class, 'updateFacility']);
    });

    Route::middleware('module:logs,settings,users')->group(function () {
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
        Route::get('/audit-logs/export', [AuditLogController::class, 'export']);
    });
});
