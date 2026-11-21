<?php

namespace App\Services;

use App\Models\VisitorLog;

class GatekeeperVisitorAutoCheckout
{
    public function run(): void
    {
        $cutoff = now()->subHours(24);

        VisitorLog::query()
            ->where('status', 'checked_in')
            ->where('check_in_at', '<=', $cutoff)
            ->whereHas('creator.role', fn ($query) => $query->where('slug', 'gatekeeper'))
            ->select(['id', 'check_in_at'])
            ->chunkById(100, function ($expiredVisits) {
                foreach ($expiredVisits as $visit) {
                    $visit->update([
                        'status' => 'checked_out',
                        'check_out_at' => $visit->check_in_at->copy()->addHours(24),
                    ]);
                }
            });
    }
}
