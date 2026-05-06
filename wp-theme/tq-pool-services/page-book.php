<?php
/**
 * Template Name: Book
 * Slug: book
 */
get_header();
?>

<section class="page-head">
	<div class="container">
		<span class="eyebrow">Book online</span>
		<h1><?php echo esc_html( get_the_title() ?: 'Book a pool service' ); ?></h1>
		<p class="page-head__lede"><?php echo esc_html( get_the_excerpt() ?: 'Pick a service and a slot. Takes about 90 seconds.' ); ?></p>
	</div>
</section>

<section class="book">
	<div class="container">
		<form id="booking-form" class="booking">
			<div class="booking__step">
				<h3>1 · What do you need?</h3>
				<div class="booking__chips">
					<label class="chip"><input type="radio" name="service" value="weekly" required><span>Weekly</span></label>
					<label class="chip"><input type="radio" name="service" value="fortnightly"><span>Fortnightly</span></label>
					<label class="chip"><input type="radio" name="service" value="4weekly"><span>4-weekly</span></label>
					<label class="chip"><input type="radio" name="service" value="oneoff"><span>One-off clean</span></label>
					<label class="chip"><input type="radio" name="service" value="green"><span>Green pool recovery</span></label>
				</div>
			</div>
			<div class="booking__step">
				<h3>2 · Where's the pool?</h3>
				<div class="form-row">
					<label>Suburb<input type="text" name="suburb" required></label>
					<label>Pool size (litres, est.)<input type="number" name="pool_size" min="0"></label>
				</div>
				<label>Address<input type="text" name="address" required></label>
				<label>Anything we should know?<textarea name="notes" rows="3"></textarea></label>
			</div>
			<div class="booking__step">
				<h3>3 · Who are we visiting?</h3>
				<div class="form-row">
					<label>Name<input type="text" name="name" required></label>
					<label>Phone<input type="tel" name="phone" required></label>
				</div>
				<label>Email<input type="email" name="email" required></label>
			</div>
			<div class="booking__step">
				<h3>4 · Pick a slot</h3>
				<input type="date" name="preferred_date" required>
				<select name="preferred_window" required>
					<option value="">Window…</option>
					<option value="am">Morning (7–11)</option>
					<option value="midday">Midday (11–2)</option>
					<option value="pm">Afternoon (2–5)</option>
				</select>
			</div>
			<div class="booking__submit">
				<button type="submit" class="btn btn-accent btn-lg">Confirm booking &amp; pay deposit</button>
				<p class="form-note">$0 fee to book. Deposit collected via Square. Card never stored.</p>
			</div>
		</form>
	</div>
</section>

<?php get_footer(); ?>
