<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class SecureUpload
{
    public static function storeBillImage(UploadedFile $file, string $folder = 'bills'): string
    {
        return self::storeImage($file, $folder, 'bill_');
    }

    public static function storeImage(UploadedFile $file, string $folder, string $prefix = 'img_'): string
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        if (! in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
            $ext = 'jpg';
        }
        $name = $folder.'/'.now()->format('Y/m').'/'.uniqid($prefix, true).'.'.$ext;

        return $file->storeAs(dirname($name), basename($name), 'public');
    }

    public static function url(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $url = Storage::disk('public')->url($path);
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }

        return rtrim((string) config('app.url'), '/').'/'.ltrim($url, '/');
    }
}
