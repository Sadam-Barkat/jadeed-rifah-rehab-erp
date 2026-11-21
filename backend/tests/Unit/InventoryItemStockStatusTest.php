<?php

namespace Tests\Unit;

use App\Models\InventoryItem;
use PHPUnit\Framework\TestCase;

class InventoryItemStockStatusTest extends TestCase
{
    public function test_assets_can_show_low_stock_status_with_the_automatic_threshold(): void
    {
        $chair = new InventoryItem([
            'category' => 'furniture',
            'stock_qty' => 5,
            'reorder_level' => 10,
            'track_reorder' => true,
        ]);

        $this->assertSame('Low stock', $chair->stockStatusLabel());
        $this->assertTrue($chair->isLowStock());
    }

    public function test_tracked_items_report_low_and_out_of_stock_status(): void
    {
        $lowStock = new InventoryItem([
            'stock_qty' => 3,
            'reorder_level' => 5,
            'track_reorder' => true,
        ]);
        $outOfStock = new InventoryItem([
            'stock_qty' => 0,
            'reorder_level' => 5,
            'track_reorder' => true,
        ]);

        $this->assertSame('Low stock', $lowStock->stockStatusLabel());
        $this->assertTrue($lowStock->isLowStock());
        $this->assertSame('Out of stock', $outOfStock->stockStatusLabel());
        $this->assertTrue($outOfStock->isLowStock());
    }

    public function test_count_units_are_distinguished_from_weight_units(): void
    {
        $this->assertTrue(InventoryItem::isCountUnit('pcs'));
        $this->assertFalse(InventoryItem::isCountUnit('kg'));
    }
}
