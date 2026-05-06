<?php
/**
 * Template Name: Booking success
 * Slug: booking-success
 */
get_header();
?>

<section class="page-head">
	<div class="container">
		<span class="eyebrow">Booked</span>
		<h1><?php echo esc_html( get_the_title() ?: "You're booked in" ); ?></h1>
		<p class="page-head__lede"><?php echo esc_html( get_the_excerpt() ?: "We'll send a confirmation SMS the day before. Anything change in the meantime, just reply to it." ); ?></p>
	</div>
</section>

<?php if ( get_the_content() ) : ?>
<section class="prose">
	<div class="container">
		<div class="prose__inner reveal">
			<div class="prose__text">
				<?php while ( have_posts() ) : the_post(); the_content(); endwhile; ?>
			</div>
		</div>
	</div>
</section>
<?php endif; ?>

<section class="cta-final">
	<div class="container">
		<div class="cta-final__card reveal">
			<h2>Anything else?</h2>
			<p>Browse our shop for chemicals, cartridges and basics — same-week local dispatch.</p>
			<a href="<?php echo esc_url( home_url( '/products/' ) ); ?>" class="btn btn-primary">Visit the shop</a>
		</div>
	</div>
</section>

<?php get_footer(); ?>
