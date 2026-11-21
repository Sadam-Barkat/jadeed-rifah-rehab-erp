# Jadeed Rifah Rehab ERP — How To Use

Lean build: **8 roles only**. Extra modules were removed from code and database.

## Login (seeded test staff)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@jadeed.local` | `Admin@123` |
| Receptionist | `reception@jadeed.local` | `Reception@123` |
| Gatekeeper | `gate@jadeed.local` | `Gate@123` |
| Doctor | `doctor@jadeed.local` | `Doctor@123` |
| Nurse | `nurse@jadeed.local` | `Nurse@123` |
| Finance | `finance@jadeed.local` | `Finance@123` |
| Pharmacist | `pharmacist@jadeed.local` | `Pharmacist@123` |
| Inventory Manager | `inventory@jadeed.local` | `Inventory@123` |

Demo data: ~10 rows per major list (patients, invoices/payments, visitors, pharmacy/inventory moves, petty, facility bills, nursing/doctor notes, ledger).  
Extra staff can still be created by Admin in Management (no self-signup / forgot-password).

---

## Step 1 — Login as Admin

1. Open the app → login with Admin.
2. Go to **Management → Staff**.
3. **Add staff**: name, email, **phone**, role.
4. Password is generated automatically and shown **once** in **Login credentials**.
5. Admin **Copy** or **WhatsApp** (opens chat with that phone + email/password message).
6. Staff login with that email + password.
7. If password is lost/leaked: Admin taps **Regenerate** → same one-time popup → send again.

---

## Roles

1. Admin — Overview tabs (Patients, Pharmacy, Inventory, Finance, Visitors, Staff) + Management + Settings + Logs  
2. Receptionist — top navbar: Register · Pending · Assign bed · Admitted
   (No stats home — only Admin sees dashboards. Login opens Register.)
   Admitted: View → Print / PDF on detail.
3. Gatekeeper — top navbar: Staff Attendance · Visitors (no home/stats). Visitor entry uses one searchable patient picker; the visitor log shows the last 24 hours, and Gatekeeper check-ins auto-checkout after 24 hours.
4. Doctor — medical care  
5. Nurse — nursing notes  
6. Finance — top navbar (no sidebar): Fees & payments · Petty expenses · Facility bills  
   Fees & payments has inner tabs (Create Invoice / Awaiting plan / Payment pending / Cleared).  
   Admin finance: Overview · Petty · Facility bills. Plan/payment approve opens from notification → detail page.  
   All non-admin roles use the same top navbar (logo + modules + bell + profile). Admin keeps sidebar.  
7. Pharmacist — medicines only (stock in + dispense to patients)  
8. Inventory Manager — top navbar: Use Stock · Receive Stock · Stock Levels. Use Stock is the default page; add purchases and new items in Receive Stock. Stock Levels highlights low and out-of-stock items. Every item receives an automatic reorder threshold of 10 units.

Medicines are **not** in Inventory. Receive Stock lets staff select an existing item or add a new item, then record quantity, per-unit cost, bill / receipt, and supplier. The signed-in staff member is recorded automatically and shown in Admin reports. Admin receives a notification for each stock receipt; opening it shows the receipt details and bill.
Inventory **Beds** category: stock receipt adds beds (room `INV`). Beds are not stocked out — pick a bed for **Maintenance** (status only) or **Total discard** (stock −1). Occupied beds blocked until patient discharge.

Admin does not do day-to-day add/stock work in module forms — that stays role-wise.  
Management tab: add/update/delete staff and manage patients.  

---

## Notifications (Bell)

- Topbar **bell** shows unread count (not on sidebar tabs).
- Open panel → all notifications (old + new). **Mark all read** available.
- Time shows real datetime (e.g. 18 Nov, 02:57 pm).
- Closed envelope → mark as read only. Open envelope after read. Row click → open linked page + mark read.

## Agreed patient / fee flow (building phase by phase)

1. **Receptionist** fills patient + guardian details (CNIC front/back + plan 30/60/90) → **Submit request**.
2. **Admin** opens request (Management / bell) → **Approve** or **Reject** only (no bed assign).
3. After approve → **Receptionist** Assign bed → patient becomes **Admitted**.
4. **Finance** is notified only after full admit (bed assigned) → Create Invoice (patient preselected).
5. **Doctor** requests discharge → Admin confirms → Discharged.
6. Management patient stages: Pending · Approved · Rejected · Admitted · Discharge requests · Discharged.

**Done now:**
- Bell notifications
- Reception desk tabs (Register / Pending / Assign bed / Admitted) + card lists
- Registration always creates an approval request (no admin bed on register)
- Admin Approve / Reject on patient detail
- Reception bed assign after approve → finance notified on full admit
- Management patient stages include Approved / Rejected
- Doctor **Request discharge** → Admin confirms
- Fees & payments inner tabs: Create Invoice → Awaiting plan → Payment pending → Cleared
- Invoice status badges: Due · Awaiting approval · Paid
- Payment proof → Admin Accept/Reject
- Default: **1 invoice** (30/60/90); installments only when requested
- Finance dashboard shows approved collection + pending requests

## Daily flow (current lean)

```
Receptionist registers (request)
→ Admin Approve / Reject
→ Receptionist assigns bed → Admitted
→ Finance notified (create invoice)
→ Doctor / Nurse care
→ Discharge request → Admin confirm
```
