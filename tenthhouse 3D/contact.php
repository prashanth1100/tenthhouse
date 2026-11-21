<?php
/**
 * Tenth House Studio — enquiry form handler.
 * Works on any standard PHP host (including the current WordPress hosting).
 * Server-side validation + honeypot + time-trap. No secrets are stored here.
 * Change TO_EMAIL if enquiries should go elsewhere.
 */
declare(strict_types=1);

const TO_EMAIL   = 'Tenthhouseportraits@gmail.com';
const FROM_EMAIL = 'no-reply@tenthhousestudio.com'; // must be a domain your host is allowed to send from

const SERVICES = [
  'Newborn Photography', 'Maternity Portraits', 'Children Portraiture', 'Solo Portraiture',
  'Couple Portraits', 'Family Portraits', 'Business Headshots', 'In The Box Photography',
  'Birthday Events', 'Baby Shower Events', 'Housewarming Events',
  'Music Video Shoots', 'Promotional Reels', 'Podcasting', 'Studio Space Rentals', 'Something else',
];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond(int $code, array $body): void {
  http_response_code($code);
  echo json_encode($body);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

// Spam protection: honeypot must be empty, and a human takes more than 3 seconds.
if (!empty($_POST['website'] ?? '') || (int)($_POST['elapsed'] ?? 0) < 3000) {
  respond(200, ['ok' => true]); // pretend success for bots
}

$clean = static fn(string $k, int $max): string =>
  mb_substr(trim(str_replace(["\r", "\0"], '', (string)($_POST[$k] ?? ''))), 0, $max);

$name    = $clean('name', 100);
$phone   = $clean('phone', 20);
$email   = $clean('email', 150);
$service = $clean('service', 60);
$date    = $clean('date', 10);
$message = $clean('message', 3000);

$errors = [];
if (mb_strlen($name) < 2) $errors['name'] = 'Please enter your name.';
if (!preg_match('/^[+\d][\d\s-]{7,15}$/', $phone)) $errors['phone'] = 'Please enter a valid phone number.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Please enter a valid email address.';
if (!in_array($service, SERVICES, true)) $errors['service'] = 'Please choose a service.';
if ($date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $errors['date'] = 'Please choose a valid date.';
if (mb_strlen($message) < 10) $errors['message'] = 'Please tell us a little more.';

if ($errors) respond(422, ['ok' => false, 'error' => 'validation', 'fields' => $errors]);

$name = str_replace("\n", ' ', $name); // header-injection guard

$body = "New enquiry from tenthhousestudio.com\n\n"
      . "Name: {$name}\nPhone: {$phone}\nEmail: {$email}\nService: {$service}\n"
      . 'Preferred date: ' . ($date ?: 'Flexible') . "\n\nMessage:\n{$message}\n";

$headers = implode("\r\n", [
  'From: Tenth House Studio Website <' . FROM_EMAIL . '>',
  'Reply-To: ' . $email,
  'Content-Type: text/plain; charset=UTF-8',
]);

$sent = @mail(TO_EMAIL, "Session enquiry: {$service} — {$name}", $body, $headers);

if (!$sent) respond(500, ['ok' => false, 'error' => 'send_failed']);
respond(200, ['ok' => true]);
