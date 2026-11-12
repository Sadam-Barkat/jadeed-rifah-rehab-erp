# Jadeed Rifah Rehab ERP — How To Use

Lean build: **8 roles only**. Extra modules were removed from code and database.

## Login (only Admin is seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@jadeed.local` | `Admin@123` |

All other staff are **created by Admin** in the app (email required).

---

## Step 1 — Login as Admin

1. Open the app → login with Admin.
2. Go to **Staff & Users**.
3. Add staff: full name, **email**, role.
4. Copy the temporary password and give it to that person.
5. They login with that email + password.

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

## Daily flow

```
Receptionist registers + admits
→ Doctor / Nurse care
→ Pharmacist / Inventory stock
→ Gatekeeper visitors
→ Finance collects fees
→ Admin oversees
```

More modules can be added later when needed.
