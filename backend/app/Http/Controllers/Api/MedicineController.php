<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use App\Models\MedicineMovement;
use App\Models\User;
use App\Services\AppNotifier;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MedicineController extends Controller
{
    public const FORMS = [
        'tablet',
        'capsule',
        'syrup',
        'injection',
        'drops',
        'cream',
        'ointment',
        'inhaler',
        'powder',
        'suspension',
        'ampoule',
        'other',
    ];

    public const UNITS = [
        'tablet',
        'capsule',
        'ml',
        'bottle',
        'strip',
        'box',
        'vial',
        'ampoule',
        'tube',
        'sachet',
        'unit',
    ];

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $query = Medicine::query()
            ->with('creator:id,name,staff_code')
            ->withUsableExpiry()
            ->withExpiryFlags()
            ->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($request->boolean('usable_only')) {
            $query->usableForDispense();
        }

        if ($createdBy = $request->integer('created_by')) {
            $query->where('created_by', $createdBy);
        }

        if ($form = $request->get('form')) {
            $query->where('form', $form);
        }

        if ($category = $request->get('category')) {
            $query->where('category', $category);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('medicine_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('generic_name', 'like', "%{$search}%")
                    ->orWhere('manufacturer', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Medicine $m) => $this->payload($m)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'forms' => self::FORMS,
                'units' => self::UNITS,
                'categories' => $this->categoryOptions(),
                'staff' => $this->staffOptions(),
            ],
        ]);
    }

    /** Expired receive batches (same medicine can still appear in stock if new batch exists). */
    public function expired(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 50), 1), 100);
        $today = now()->toDateString();

        $query = MedicineMovement::query()
            ->with([
                'medicine:id,medicine_code,name,generic_name,form,strength,unit,category,stock_qty',
                'creator:id,name,staff_code',
            ])
            ->where('type', 'in')
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', $today)
            ->latest('expiry_date');

        if ($search = trim((string) $request->get('search', ''))) {
            $query->whereHas('medicine', function ($q) use ($search) {
                $q->where('medicine_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('generic_name', 'like', "%{$search}%");
            });
        }

        if ($date = $request->get('date')) {
            $query->whereDate('expiry_date', $date);
        } else {
            if ($year = $request->integer('year')) {
                $query->whereYear('expiry_date', $year);
            }
            if ($month = $request->integer('month')) {
                $query->whereMonth('expiry_date', $month);
            }
        }

        $paginator = $query->paginate($perPage);

        $years = MedicineMovement::query()
            ->where('type', 'in')
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', $today)
            ->selectRaw('DISTINCT YEAR(expiry_date) as y')
            ->orderByDesc('y')
            ->pluck('y')
            ->filter()
            ->values()
            ->all();

        return response()->json([
            'data' => collect($paginator->items())->map(function (MedicineMovement $row) {
                $expiry = $row->expiry_date?->toDateString();
                $daysExpired = $expiry
                    ? max(0, (int) $row->expiry_date->copy()->startOfDay()->diffInDays(now()->startOfDay()))
                    : null;

                return [
                    'id' => $row->id,
                    'movement_code' => $row->movement_code,
                    'batch_no' => $row->batch_no,
                    'quantity' => $row->quantity,
                    'expiry_date' => $expiry,
                    'days_expired' => $daysExpired,
                    'supplier' => $row->supplier,
                    'unit_cost' => $row->unit_cost,
                    'received_at' => $row->moved_at?->toDateTimeString(),
                    'recorded_by' => $row->creator?->name,
                    'medicine' => [
                        'id' => $row->medicine?->id,
                        'medicine_code' => $row->medicine?->medicine_code,
                        'name' => $row->medicine?->name,
                        'generic_name' => $row->medicine?->generic_name,
                        'form' => $row->medicine?->form,
                        'strength' => $row->medicine?->strength,
                        'unit' => $row->medicine?->unit,
                        'category' => $row->medicine?->category,
                        'category_label' => Medicine::categoryLabel($row->medicine?->category),
                        'stock_qty' => $row->medicine?->stock_qty,
                    ],
                ];
            })->values()->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'available_years' => $years,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:60'],
            'form' => ['required', Rule::in(self::FORMS)],
            'strength' => ['nullable', 'string', 'max:50'],
            'unit' => ['required', Rule::in(self::UNITS)],
            'manufacturer' => ['nullable', 'string', 'max:150'],
            'stock_qty' => ['required', 'integer', 'min:1'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'batch_no' => ['nullable', 'string', 'max:80'],
            'expiry_date' => ['nullable', 'date'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'reference' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'bill_image' => SecureUpload::imageRules(true, true),
        ], SecureUpload::maxMessages([
            'bill_image' => 'Bill image',
        ]));

        $billPath = SecureUpload::storeBillImage($request->file('bill_image'), 'medicine-bills');

        $medicine = DB::transaction(function () use ($request, $data, $billPath) {
            $opening = (int) $data['stock_qty'];

            $medicine = Medicine::query()->create([
                'medicine_code' => $this->nextCode(),
                'name' => $data['name'],
                'generic_name' => $data['generic_name'] ?? null,
                'category' => Medicine::normalizeCategory($data['category'] ?? 'other'),
                'form' => $data['form'],
                'strength' => $data['strength'] ?? null,
                'unit' => $data['unit'],
                'manufacturer' => $data['manufacturer'] ?? null,
                'stock_qty' => $opening,
                'reorder_level' => $data['reorder_level'] ?? 10,
                'unit_price' => $data['unit_price'] ?? 0,
                'status' => $data['status'] ?? 'active',
                'created_by' => $request->user()->id,
            ]);

            MedicineMovement::query()->create([
                'movement_code' => $this->nextMovementCode(),
                'medicine_id' => $medicine->id,
                'type' => 'in',
                'quantity' => $opening,
                'batch_no' => $data['batch_no'] ?? null,
                'expiry_date' => $data['expiry_date'] ?? null,
                'supplier' => $data['supplier'] ?? null,
                'unit_cost' => $data['unit_price'] ?? null,
                'reference' => $data['reference'] ?? null,
                'bill_image_path' => $billPath,
                'notes' => $data['notes'] ?? 'Stock received',
                'moved_at' => now(),
                'created_by' => $request->user()->id,
            ]);

            return $medicine->load('creator:id,name,staff_code');
        });

        return response()->json([
            'message' => 'Medicine added',
            'data' => $this->payload($medicine),
        ], 201);
    }

    public function storeBatch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => ['nullable', 'integer', 'exists:medicines,id'],
            'items.*.name' => ['nullable', 'string', 'max:255'],
            'items.*.generic_name' => ['nullable', 'string', 'max:255'],
            'items.*.category' => ['nullable', 'string', 'max:60'],
            'items.*.form' => ['nullable', Rule::in(self::FORMS)],
            'items.*.strength' => ['nullable', 'string', 'max:50'],
            'items.*.unit' => ['nullable', Rule::in(self::UNITS)],
            'items.*.manufacturer' => ['nullable', 'string', 'max:150'],
            'items.*.stock_qty' => ['required', 'integer', 'min:1'],
            'items.*.reorder_level' => ['nullable', 'integer', 'min:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.batch_no' => ['nullable', 'string', 'max:80'],
            'items.*.expiry_date' => ['nullable', 'date'],
            'items.*.supplier' => ['nullable', 'string', 'max:150'],
            'items.*.notes' => ['nullable', 'string'],
            'bill_image' => SecureUpload::imageRules(true, true),
        ], SecureUpload::maxMessages([
            'bill_image' => 'Bill image',
        ]));

        foreach ($data['items'] as $index => $item) {
            if (empty($item['medicine_id']) && blank($item['name'] ?? null)) {
                return response()->json(['message' => 'Medicine name is required for item '.($index + 1).'.'], 422);
            }
            if (empty($item['medicine_id']) && (blank($item['form'] ?? null) || blank($item['unit'] ?? null))) {
                return response()->json(['message' => 'Form and unit are required for new medicine on item '.($index + 1).'.'], 422);
            }
        }

        $billPath = SecureUpload::storeBillImage($request->file('bill_image'), 'medicine-bills');

        $result = DB::transaction(function () use ($request, $data, $billPath) {
            $rows = [];
            $movementIds = [];
            foreach ($data['items'] as $item) {
                $qty = (int) $item['stock_qty'];

                if (! empty($item['medicine_id'])) {
                    $medicine = Medicine::query()->lockForUpdate()->findOrFail($item['medicine_id']);
                    if ($medicine->status !== 'active') {
                        throw new \RuntimeException("{$medicine->name} is inactive.");
                    }
                    $medicine->update([
                        'stock_qty' => (int) $medicine->stock_qty + $qty,
                        'unit_price' => $item['unit_price'] ?? $medicine->unit_price,
                    ]);
                } else {
                    $medicine = Medicine::query()->create([
                        'medicine_code' => $this->nextCode(),
                        'name' => $item['name'],
                        'generic_name' => $item['generic_name'] ?? null,
                        'category' => Medicine::normalizeCategory($item['category'] ?? 'other'),
                        'form' => $item['form'],
                        'strength' => $item['strength'] ?? null,
                        'unit' => $item['unit'],
                        'manufacturer' => $item['manufacturer'] ?? null,
                        'stock_qty' => $qty,
                        'reorder_level' => $item['reorder_level'] ?? 10,
                        'unit_price' => $item['unit_price'] ?? 0,
                        'status' => 'active',
                        'created_by' => $request->user()->id,
                    ]);
                }

                $movement = MedicineMovement::query()->create([
                    'movement_code' => $this->nextMovementCode(),
                    'medicine_id' => $medicine->id,
                    'type' => 'in',
                    'quantity' => $qty,
                    'batch_no' => $item['batch_no'] ?? null,
                    'expiry_date' => $item['expiry_date'] ?? null,
                    'supplier' => $item['supplier'] ?? null,
                    'unit_cost' => $item['unit_price'] ?? null,
                    'bill_image_path' => $billPath,
                    'notes' => $item['notes'] ?? 'Batch stock received',
                    'moved_at' => now(),
                    'created_by' => $request->user()->id,
                ]);

                $movementIds[] = $movement->id;
                $rows[] = $this->payload($medicine->fresh()->load('creator:id,name,staff_code'));
            }

            return [
                'rows' => $rows,
                'movement_ids' => $movementIds,
                'first_movement_id' => $movementIds[0] ?? null,
            ];
        });

        if (! empty($result['first_movement_id'])) {
            $count = count($result['rows']);
            $body = $count.' medicine'.($count === 1 ? '' : 's').' received';
            if ($request->user()?->name) {
                $body .= ' · Recorded by: '.$request->user()->name;
            }
            app(AppNotifier::class)->notifyRoleSlugs(
                ['admin', 'owner'],
                'pharmacy.stock_received',
                'Medicine stock received',
                $body,
                '/app/medicine-receipts/'.$result['first_movement_id'],
                [
                    'medicine_movement_id' => $result['first_movement_id'],
                    'medicine_movement_ids' => $result['movement_ids'],
                ],
                $request->user()->id,
            );
        }

        return response()->json([
            'message' => count($result['rows']).' medicines received',
            'data' => $result['rows'],
            'meta' => [
                'receipt_id' => $result['first_movement_id'],
            ],
        ], 201);
    }

    public function update(Request $request, Medicine $medicine): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:60'],
            'form' => ['nullable', Rule::in(self::FORMS)],
            'strength' => ['nullable', 'string', 'max:50'],
            'unit' => ['nullable', Rule::in(self::UNITS)],
            'manufacturer' => ['nullable', 'string', 'max:150'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if (array_key_exists('category', $data)) {
            $data['category'] = Medicine::normalizeCategory($data['category']);
        }

        $medicine->update($data);

        return response()->json([
            'message' => 'Medicine updated',
            'data' => $this->payload($medicine->fresh()->load('creator:id,name,staff_code')),
        ]);
    }

    private function payload(Medicine $medicine): array
    {
        if (! array_key_exists('usable_expiry_date', $medicine->getAttributes())
            && ! array_key_exists('nearest_expiry_date', $medicine->getAttributes())) {
            $today = now()->toDateString();
            $medicine->usable_expiry_date = $medicine->movements()
                ->where('type', 'in')
                ->whereNotNull('expiry_date')
                ->whereDate('expiry_date', '>=', $today)
                ->min('expiry_date');
            $medicine->nearest_expiry_date = $medicine->movements()
                ->where('type', 'in')
                ->whereNotNull('expiry_date')
                ->min('expiry_date');
        }

        return [
            'id' => $medicine->id,
            'medicine_code' => $medicine->medicine_code,
            'name' => $medicine->name,
            'generic_name' => $medicine->generic_name,
            'category' => $medicine->category ?: 'other',
            'category_label' => Medicine::categoryLabel($medicine->category),
            'form' => $medicine->form,
            'strength' => $medicine->strength,
            'unit' => $medicine->unit,
            'manufacturer' => $medicine->manufacturer,
            'stock_qty' => $medicine->stock_qty,
            'reorder_level' => $medicine->reorder_level,
            'unit_price' => $medicine->unit_price,
            'expiry_date' => $medicine->nearestExpiryDate(),
            'is_expired' => $medicine->isFullyExpired(),
            'low_stock' => $medicine->stock_qty <= $medicine->reorder_level,
            'status' => $medicine->status,
            'recorded_by' => $medicine->creator?->name,
            'recorded_by_id' => $medicine->created_by,
        ];
    }

    private function categoryOptions(): array
    {
        $fromDb = Medicine::query()
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->distinct()
            ->orderBy('category')
            ->pluck('category')
            ->all();

        $keys = collect(Medicine::CATEGORIES)
            ->merge($fromDb)
            ->unique()
            ->values();

        return $keys->map(fn (string $key) => [
            'value' => $key,
            'label' => Medicine::categoryLabel($key),
        ])->all();
    }

    private function staffOptions(): array
    {
        return User::query()
            ->where('is_active', true)
            ->whereHas('role', fn ($q) => $q->whereIn('slug', ['dispenser', 'pharmacist']))
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

    private function nextCode(): string
    {
        $prefix = 'MED-';
        $latest = Medicine::query()
            ->where('medicine_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('medicine_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function nextMovementCode(): string
    {
        $prefix = 'MM-'.now()->format('Y').'-';
        $latest = MedicineMovement::query()
            ->where('movement_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('movement_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
