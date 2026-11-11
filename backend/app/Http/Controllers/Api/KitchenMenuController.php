<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KitchenMenu;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class KitchenMenuController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = KitchenMenu::query()->latest('menu_date')->latest('id');

        if ($date = $request->get('date')) {
            $query->whereDate('menu_date', $date);
        }

        if ($meal = $request->get('meal_type')) {
            $query->where('meal_type', $meal);
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (KitchenMenu $m) => $this->payload($m)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'menu_date' => ['required', 'date'],
            'meal_type' => ['required', Rule::in(['breakfast', 'lunch', 'dinner', 'snack'])],
            'menu_items' => ['required', 'string'],
            'portions' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['planned', 'served', 'cancelled'])],
        ]);

        if (KitchenMenu::query()
            ->whereDate('menu_date', $data['menu_date'])
            ->where('meal_type', $data['meal_type'])
            ->exists()) {
            return response()->json(['message' => 'Menu already exists for this meal on the selected date.'], 422);
        }

        $menu = KitchenMenu::query()->create([
            'menu_code' => $this->nextCode(),
            'menu_date' => $data['menu_date'],
            'meal_type' => $data['meal_type'],
            'menu_items' => $data['menu_items'],
            'portions' => $data['portions'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => $data['status'] ?? 'planned',
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Kitchen menu saved',
            'data' => $this->payload($menu),
        ], 201);
    }

    public function update(Request $request, KitchenMenu $kitchenMenu): JsonResponse
    {
        $data = $request->validate([
            'menu_items' => ['nullable', 'string'],
            'portions' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['planned', 'served', 'cancelled'])],
        ]);

        $kitchenMenu->update($data);

        return response()->json([
            'message' => 'Kitchen menu updated',
            'data' => $this->payload($kitchenMenu->fresh()),
        ]);
    }

    private function payload(KitchenMenu $menu): array
    {
        return [
            'id' => $menu->id,
            'menu_code' => $menu->menu_code,
            'menu_date' => $menu->menu_date?->format('Y-m-d'),
            'meal_type' => $menu->meal_type,
            'menu_items' => $menu->menu_items,
            'portions' => $menu->portions,
            'notes' => $menu->notes,
            'status' => $menu->status,
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "MENU-{$year}-";
        $latest = KitchenMenu::query()
            ->where('menu_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('menu_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
