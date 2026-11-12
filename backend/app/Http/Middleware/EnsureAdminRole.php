<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminRole
{
    public function handle(Request $request, Closure $next): Response
    {
        $slug = $request->user()?->loadMissing('role')->role?->slug;

        if (! in_array($slug, ['admin', 'owner'], true)) {
            return response()->json(['message' => 'Only Admin can perform this action.'], 403);
        }

        return $next($request);
    }
}
