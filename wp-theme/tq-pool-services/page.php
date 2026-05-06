<?php
/**
 * Generic page template — used for any page that doesn't have a
 * specific page-{slug}.php template.
 */
get_header();
?>

<?php while ( have_posts() ) : the_post(); ?>
<section class="page-head">
	<div class="container">
		<h1><?php the_title(); ?></h1>
		<?php if ( $excerpt = get_the_excerpt() ) : ?>
			<p class="page-head__lede"><?php echo esc_html( $excerpt ); ?></p>
		<?php endif; ?>
	</div>
</section>

<section class="prose">
	<div class="container">
		<div class="prose__inner reveal">
			<div class="prose__text">
				<?php the_content(); ?>
			</div>
		</div>
	</div>
</section>
<?php endwhile; ?>

<?php get_footer(); ?>
