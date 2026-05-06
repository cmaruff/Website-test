<?php
/**
 * Template Name: Contact
 * Slug: contact
 */
get_header();
$phone = tqps_setting( 'biz_phone' );
$email = tqps_setting( 'biz_email' );
?>

<section class="page-head">
	<div class="container">
		<span class="eyebrow">Contact</span>
		<h1><?php echo esc_html( get_the_title() ?: 'Get in touch' ); ?></h1>
		<p class="page-head__lede"><?php echo esc_html( get_the_excerpt() ?: "We reply within a business day. Quick questions? Just call." ); ?></p>
	</div>
</section>

<section class="contact">
	<div class="container contact__grid">
		<div class="contact__info reveal">
			<?php if ( $phone ) : ?>
				<a class="contact__item" href="tel:<?php echo esc_attr( $phone ); ?>">
					<span class="eyebrow">Call</span>
					<strong><?php echo esc_html( $phone ); ?></strong>
				</a>
			<?php endif; ?>
			<?php if ( $email ) : ?>
				<a class="contact__item" href="mailto:<?php echo esc_attr( $email ); ?>">
					<span class="eyebrow">Email</span>
					<strong><?php echo esc_html( $email ); ?></strong>
				</a>
			<?php endif; ?>
			<?php if ( $hours = tqps_setting( 'biz_hours' ) ) : ?>
				<div class="contact__item">
					<span class="eyebrow">Hours</span>
					<strong><?php echo esc_html( $hours ); ?></strong>
				</div>
			<?php endif; ?>
		</div>
		<form id="contact-form" class="contact__form reveal">
			<label>Name<input type="text" name="name" required></label>
			<label>Email<input type="email" name="email" required></label>
			<label>Phone<input type="tel" name="phone"></label>
			<label>How can we help?<textarea name="message" rows="5" required></textarea></label>
			<button type="submit" class="btn btn-accent btn-lg">Send</button>
			<p class="form-note">We'll reply within a business day.</p>
		</form>
	</div>
</section>

<?php get_footer(); ?>
