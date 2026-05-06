<?php
/**
 * Single blog post.
 */
get_header();
?>

<?php while ( have_posts() ) : the_post(); ?>
<article class="post-single">
	<header class="page-head">
		<div class="container">
			<span class="eyebrow"><?php echo esc_html( get_the_date() ); ?></span>
			<h1><?php the_title(); ?></h1>
			<?php if ( $excerpt = get_the_excerpt() ) : ?>
				<p class="page-head__lede"><?php echo esc_html( $excerpt ); ?></p>
			<?php endif; ?>
		</div>
	</header>

	<?php if ( has_post_thumbnail() ) : ?>
		<div class="post-single__hero container">
			<?php the_post_thumbnail( 'large' ); ?>
		</div>
	<?php endif; ?>

	<section class="prose">
		<div class="container">
			<div class="prose__inner reveal">
				<div class="prose__text">
					<?php the_content(); ?>
				</div>
			</div>
		</div>
	</section>

	<?php if ( comments_open() || get_comments_number() ) : ?>
		<section class="prose">
			<div class="container"><div class="prose__inner"><div class="prose__text">
				<?php comments_template(); ?>
			</div></div></div>
		</section>
	<?php endif; ?>
</article>
<?php endwhile; ?>

<?php get_footer(); ?>
