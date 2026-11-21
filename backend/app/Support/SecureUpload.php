<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class SecureUpload
{
    /** Max upload size in kilobytes (Laravel `max:` rule). */
    public const MAX_KB = 40960;

    /** Friendly size shown in validation errors. */
    public const MAX_MB = 40;

    public static function storeBillImage(UploadedFile $file, string $folder = 'bills'): string
    {
        return self::storeImage($file, $folder, 'bill_');
    }

    public static function storeImage(UploadedFile $file, string $folder, string $prefix = 'img_'): string
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        if (! in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'pdf'], true)) {
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

    /**
     * @return list<string>
     */
    public static function imageRules(bool $required = false, bool $allowPdf = false): array
    {
        $mimes = $allowPdf ? 'jpg,jpeg,png,webp,pdf' : 'jpg,jpeg,png,webp';

        return [
            $required ? 'required' : 'nullable',
            'file',
            'max:'.self::MAX_KB,
            'mimes:'.$mimes,
        ];
    }

    public static function maxMessage(string $label = 'Image'): string
    {
        return $label.' must be '.self::MAX_MB.' MB or smaller.';
    }

    /**
     * @param  list<string>  $fields  Field names → human labels
     * @return array<string, string>
     */
    public static function maxMessages(array $fields): array
    {
        $out = [];
        foreach ($fields as $field => $label) {
            $out[$field.'.max'] = self::maxMessage($label);
        }

        return $out;
    }
}
