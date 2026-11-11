<?php

namespace Database\Seeders;

use App\Models\Bed;
use App\Models\Room;
use Illuminate\Database\Seeder;

class RoomBedSeeder extends Seeder
{
    public function run(): void
    {
        $rooms = [
            ['name' => 'Ward A', 'code' => 'WA', 'floor' => '1', 'room_type' => 'General', 'beds' => 8],
            ['name' => 'Ward B', 'code' => 'WB', 'floor' => '1', 'room_type' => 'General', 'beds' => 8],
            ['name' => 'Ward C', 'code' => 'WC', 'floor' => '2', 'room_type' => 'General', 'beds' => 8],
            ['name' => 'Private 1', 'code' => 'P1', 'floor' => '2', 'room_type' => 'Private', 'beds' => 3],
            ['name' => 'Private 2', 'code' => 'P2', 'floor' => '2', 'room_type' => 'Private', 'beds' => 3],
        ];

        foreach ($rooms as $roomData) {
            $room = Room::query()->updateOrCreate(
                ['code' => $roomData['code']],
                [
                    'name' => $roomData['name'],
                    'floor' => $roomData['floor'],
                    'room_type' => $roomData['room_type'],
                    'status' => 'active',
                ]
            );

            for ($i = 1; $i <= $roomData['beds']; $i++) {
                Bed::query()->updateOrCreate(
                    ['bed_code' => $roomData['code'].'-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT)],
                    [
                        'room_id' => $room->id,
                        'status' => 'available',
                    ]
                );
            }
        }
    }
}
