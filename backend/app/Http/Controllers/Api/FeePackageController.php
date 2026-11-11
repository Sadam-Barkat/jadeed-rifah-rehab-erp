<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeePackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FeePackageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = FeePackage::query()->orderBy('program_days');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $packages = $query->get();

        return response()->json([
            'data' => $packages->map(fn (FeePackage $p) => $this->payload($p)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'program_days' => ['required', 'integer', Rule::in([30, 60, 90])],
            'amount' => ['required', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $package = FeePackage::query()->create([
            'name' => $data['name'],
            'program_days' => $data['program_days'],
            'amount' => $data['amount'],
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json([
            'message' => 'Fee package created',
            'data' => $this->payload($package),
        ], 201);
    }

    private function payload(FeePackage $package): array
    {
        return [
            'id' => $package->id,
            'name' => $package->name,
            'program_days' => $package->program_days,
            'amount' => $package->amount,
            'description' => $package->description,
            'status' => $package->status,
        ];
    }
}
