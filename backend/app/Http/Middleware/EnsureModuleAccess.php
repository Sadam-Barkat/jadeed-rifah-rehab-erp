<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureModuleAccess
{
    /**
     * @param  list<string>|string  $modules
     */
    public function handle(Request $request, Closure $next, string ...$modules): Response
    {
        $user = $request->user()?->loadMissing('role');
        $allowed = collect($user?->role?->modules ?? []);

        $ok = collect($modules)->contains(fn (string $module) => $allowed->contains($module));

        if (! $ok) {
            return response()->json(['message' => 'You do not have access to this module.'], 403);
        }

        return $next($request);
    }
}
