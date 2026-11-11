<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CanteenProduct;
use App\Models\CanteenSale;
use App\Models\CanteenSaleItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CanteenController extends Controller
{
    public function products(Request $request): JsonResponse
    {
        $query = CanteenProduct::query()->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $products = $query->limit(100)->get();

        return response()->json([
            'data' => $products->map(fn (CanteenProduct $p) => $this->productPayload($p)),
        ]);
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'stock_qty' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $product = CanteenProduct::query()->create([
            'product_code' => $this->nextProductCode(),
            'name' => $data['name'],
            'unit_price' => $data['unit_price'],
            'stock_qty' => $data['stock_qty'] ?? 0,
            'status' => $data['status'] ?? 'active',
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Canteen product added',
            'data' => $this->productPayload($product),
        ], 201);
    }

    public function sales(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $paginator = CanteenSale::query()
            ->with('items.product')
            ->latest('sold_at')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (CanteenSale $s) => $this->salePayload($s)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function storeSale(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => ['nullable', 'string', 'max:150'],
            'payment_method' => ['nullable', Rule::in(['cash', 'account', 'other'])],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.canteen_product_id' => ['required', 'exists:canteen_products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        try {
            $sale = DB::transaction(function () use ($request, $data) {
                $total = 0;
                $lines = [];

                foreach ($data['items'] as $row) {
                    $product = CanteenProduct::query()->lockForUpdate()->findOrFail($row['canteen_product_id']);

                    if ($product->status !== 'active') {
                        throw new \RuntimeException("Product {$product->name} is inactive.");
                    }

                    $qty = (int) $row['quantity'];
                    if ($product->stock_qty < $qty) {
                        throw new \RuntimeException("Insufficient stock for {$product->name}. Available: {$product->stock_qty}");
                    }

                    $lineTotal = round($qty * (float) $product->unit_price, 2);
                    $total += $lineTotal;

                    $product->update(['stock_qty' => $product->stock_qty - $qty]);

                    $lines[] = [
                        'canteen_product_id' => $product->id,
                        'quantity' => $qty,
                        'unit_price' => $product->unit_price,
                        'line_total' => $lineTotal,
                    ];
                }

                $sale = CanteenSale::query()->create([
                    'sale_code' => $this->nextSaleCode(),
                    'sold_at' => now(),
                    'customer_name' => $data['customer_name'] ?? null,
                    'total_amount' => round($total, 2),
                    'payment_method' => $data['payment_method'] ?? 'cash',
                    'status' => 'completed',
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $request->user()->id,
                ]);

                foreach ($lines as $line) {
                    CanteenSaleItem::query()->create([
                        'canteen_sale_id' => $sale->id,
                        ...$line,
                    ]);
                }

                return $sale->load('items.product');
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Canteen sale recorded',
            'data' => $this->salePayload($sale),
        ], 201);
    }

    private function productPayload(CanteenProduct $product): array
    {
        return [
            'id' => $product->id,
            'product_code' => $product->product_code,
            'name' => $product->name,
            'unit_price' => $product->unit_price,
            'stock_qty' => $product->stock_qty,
            'status' => $product->status,
        ];
    }

    private function salePayload(CanteenSale $sale): array
    {
        return [
            'id' => $sale->id,
            'sale_code' => $sale->sale_code,
            'sold_at' => $sale->sold_at?->toDateTimeString(),
            'customer_name' => $sale->customer_name,
            'total_amount' => $sale->total_amount,
            'payment_method' => $sale->payment_method,
            'status' => $sale->status,
            'notes' => $sale->notes,
            'items' => $sale->items->map(fn (CanteenSaleItem $i) => [
                'id' => $i->id,
                'quantity' => $i->quantity,
                'unit_price' => $i->unit_price,
                'line_total' => $i->line_total,
                'product' => [
                    'id' => $i->product?->id,
                    'product_code' => $i->product?->product_code,
                    'name' => $i->product?->name,
                ],
            ])->values(),
        ];
    }

    private function nextProductCode(): string
    {
        $prefix = 'CNP-';
        $latest = CanteenProduct::query()
            ->where('product_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('product_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function nextSaleCode(): string
    {
        $year = now()->format('Y');
        $prefix = "CNS-{$year}-";
        $latest = CanteenSale::query()
            ->where('sale_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('sale_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
