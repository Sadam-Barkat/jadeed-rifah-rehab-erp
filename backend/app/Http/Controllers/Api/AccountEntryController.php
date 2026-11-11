<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountEntry;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = AccountEntry::query()->latest('entry_date')->latest('id');

        if ($type = $request->get('type')) {
            $query->where('type', $type);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        } else {
            $query->where('status', 'posted');
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('entry_code', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhere('reference', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        $summaryQuery = AccountEntry::query()->where('status', 'posted');
        $income = (float) (clone $summaryQuery)->where('type', 'income')->sum('amount');
        $expense = (float) (clone $summaryQuery)->where('type', 'expense')->sum('amount');

        return response()->json([
            'data' => collect($paginator->items())->map(fn (AccountEntry $e) => $this->payload($e)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'summary' => [
                'income' => $income,
                'expense' => $expense,
                'balance' => round($income - $expense, 2),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entry_date' => ['nullable', 'date'],
            'type' => ['required', Rule::in(['income', 'expense'])],
            'category' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', Rule::in(['cash', 'bank', 'jazzcash', 'easypaisa', 'other'])],
            'reference' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
        ]);

        $entry = AccountEntry::query()->create([
            'entry_code' => $this->nextCode(),
            'entry_date' => $data['entry_date'] ?? now()->toDateString(),
            'type' => $data['type'],
            'category' => $data['category'],
            'amount' => $data['amount'],
            'payment_method' => $data['payment_method'] ?? 'cash',
            'reference' => $data['reference'] ?? null,
            'description' => $data['description'] ?? null,
            'status' => 'posted',
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Account entry posted',
            'data' => $this->payload($entry),
        ], 201);
    }

    public function void(AccountEntry $accountEntry): JsonResponse
    {
        if ($accountEntry->status === 'void') {
            return response()->json(['message' => 'Entry already voided.'], 422);
        }

        $accountEntry->update(['status' => 'void']);

        Audit::log('account.void', 'accounts', 'account_entry', $accountEntry->id, "Voided {$accountEntry->entry_code}");

        return response()->json([
            'message' => 'Account entry voided',
            'data' => $this->payload($accountEntry->fresh()),
        ]);
    }

    private function payload(AccountEntry $entry): array
    {
        return [
            'id' => $entry->id,
            'entry_code' => $entry->entry_code,
            'entry_date' => $entry->entry_date?->format('Y-m-d'),
            'type' => $entry->type,
            'category' => $entry->category,
            'amount' => $entry->amount,
            'payment_method' => $entry->payment_method,
            'reference' => $entry->reference,
            'description' => $entry->description,
            'status' => $entry->status,
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "ACC-{$year}-";
        $latest = AccountEntry::query()
            ->where('entry_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('entry_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
