# Jadeed Rifah Rehab ERP — How To Use

Lean build: **8 roles only**. Extra modules were removed from code and database.

## Login (only Admin is seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@jadeed.local` | `Admin@123` |

All other staff are **created by Admin** in Management (no self-signup / forgot-password).

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
2. Receptionist — register + admit  
3. Gatekeeper — visitor log  
4. Doctor — medical care  
5. Nurse — nursing notes  
6. Finance — fees + accounts  
7. Pharmacist — medicines only (stock in + dispense to patients)  
8. Inventory Manager — non-medicine stock (kitchen, beds, cameras, equipment, etc.) + kitchen  

Medicines are **not** in Inventory. Inventory can upload bill images on add / stock-in.
Both Pharmacy and Inventory lists have a **Staff** filter (who recorded the action).
Inventory **Beds** category: stock in / opening stock adds beds (room `INV`). Beds are not stocked out — pick a bed for **Maintenance** (status only) or **Total discard** (stock −1). Occupied beds blocked until patient discharge.

Admin does not do day-to-day add/stock work in module forms — that stays role-wise.  
Management tab: add/update/delete staff and manage patients.  

---

## Notifications (Bell)

- Topbar **bell** shows unread count (not on sidebar tabs).
- Open panel → all notifications (old + new). **Mark all read** available.
- Click a notification → marks read + opens linked page. Count drops only after read/click.

## Agreed patient / fee flow (building phase by phase)

1. **Receptionist** fills registration (details + CNIC front/back + plan 30/60/90). Submits as **request** (not auto-admit).
2. **Admin** reviews via Management / bell → Admit (bed) or hold/reject. Admin add form can choose Register / Admit / Discharge + plan.
3. New patient also notifies **Finance** (bell) → collect fee; proof required (online screenshot or cash image) so Admin can see payment received.
4. **Doctor** requests discharge → Admin confirms → Discharged.
5. Management patient stages (queues, not alert badges on tabs): Requests · Admitted · Discharge requests · Discharged.

**Done now:**
- Bell notifications
- Registration: plan (30/60/90) + CNIC front/back required (request, not auto-admit)
- Admin action on register: Register request **or** Register+Admit (+ bed)
- Management patient stages: Requests / Admitted / Discharge requests / Discharged
- Doctor **Request discharge** → Admin confirms
- Finance fee flow: collect + proof → **pending approval** → Admin reviews patient/amount/screenshot → **Approve** (invoice paid/partial) or Reject
- Installments = partial amounts on same invoice (each needs approval)
- Finance dashboard shows approved collection + pending requests

**Still later:** invoice auto-create on register; richer installment schedule planner.

## Daily flow (current lean)

```
Receptionist registers
→ Admin admits (planned)
→ Doctor / Nurse care
→ Finance fee + proof (planned)
→ Discharge request → Admin confirm (planned)
```
