<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class DocumentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Document::query()
            ->with(['patient', 'uploader'])
            ->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($category = $request->get('category')) {
            $query->where('category', $category);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('document_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('original_name', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Document $d) => $this->payload($d)),
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
            'title' => ['required', 'string', 'max:255'],
            'category' => ['nullable', Rule::in(['patient', 'staff', 'legal', 'clinical', 'admin', 'other'])],
            'patient_id' => ['nullable', 'exists:patients,id'],
            'description' => ['nullable', 'string'],
            'file' => ['required', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx'],
        ]);

        $file = $request->file('file');
        $path = $file->store('documents/'.now()->format('Y/m'), 'public');

        $document = Document::query()->create([
            'document_code' => $this->nextCode(),
            'title' => $data['title'],
            'category' => $data['category'] ?? 'admin',
            'patient_id' => $data['patient_id'] ?? null,
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize() ?: 0,
            'description' => $data['description'] ?? null,
            'status' => 'active',
            'uploaded_by' => $request->user()->id,
        ])->load(['patient', 'uploader']);

        return response()->json([
            'message' => 'Document uploaded',
            'data' => $this->payload($document),
        ], 201);
    }

    public function archive(Document $document): JsonResponse
    {
        if ($document->status === 'archived') {
            return response()->json(['message' => 'Document already archived.'], 422);
        }

        $document->update(['status' => 'archived']);
        $document->load(['patient', 'uploader']);

        Audit::log('document.archive', 'documents', 'document', $document->id, "Archived {$document->document_code}");

        return response()->json([
            'message' => 'Document archived',
            'data' => $this->payload($document),
        ]);
    }

    private function payload(Document $document): array
    {
        return [
            'id' => $document->id,
            'document_code' => $document->document_code,
            'title' => $document->title,
            'category' => $document->category,
            'description' => $document->description,
            'original_name' => $document->original_name,
            'mime_type' => $document->mime_type,
            'file_size' => $document->file_size,
            'file_url' => $document->file_path ? Storage::disk('public')->url($document->file_path) : null,
            'status' => $document->status,
            'uploaded_by_name' => $document->uploader?->name,
            'patient' => $document->patient ? [
                'id' => $document->patient->id,
                'patient_code' => $document->patient->patient_code,
                'full_name' => $document->patient->full_name,
            ] : null,
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "DOC-{$year}-";
        $latest = Document::query()
            ->where('document_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('document_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
