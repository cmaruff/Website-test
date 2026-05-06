<?php
/**
 * Default fallback template — used by the blog index, archives, and
 * any page WP can't otherwise place.
 */
get_header();
?>

<section class="page-head">
	<div class="container">
		<span class="eyebrow">Notes from the truck</span>
		<h1><?php
			if      ( is_home() )        single_post_title();
			elseif  ( is_category() )    single_cat_title();
			elseif  ( is_tag() )         single_tag_title();
			elseif  ( is_archive() )     the_archive_title();
			else                          echo 'Blog';
		?></h1>
	</div>
</section>

<section class="blog">
	<div class="container">
		<?php if ( have_posts() ) : ?>
			<div class="blog__grid">
				<?php while ( have_posts() ) : the_post(); ?>
					<article class="blog__card reveal">
						<?php if ( has_post_thumbnail() ) : ?>
							<a href="<?php the_permalink(); ?>" class="blog__media">
								<?php the_post_thumbnail( 'medium_large' ); ?>
							</a>
						<?php endif; ?>
						<div class="blog__body">
							<span class="eyebrow"><?php echo esc_html( get_the_date() ); ?></span>
							<h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
							<p><?php echo esc_html( get_the_excerpt() ); ?></p>
							<a href="<?php the_permalink(); ?>" class="blog__more">Read more</a>
						</div>
					</article>
				<?php endwhile; ?>
			</div>

			<nav class="blog__pagination">
				<?php the_posts_pagination( [ 'prev_text' => 'Newer', 'next_text' => 'Older' ] ); ?>
			</nav>
		<?php else : ?>
			<p>No posts yet. Add one in WordPress admin under Posts → Add New.</p>
		<?php endif; ?>
	</div>
</section>

<?php get_footer(); ?>
