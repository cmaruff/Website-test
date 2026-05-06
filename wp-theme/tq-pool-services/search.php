<?php
get_header();
?>

<section class="page-head">
	<div class="container">
		<span class="eyebrow">Search</span>
		<h1>Results for &ldquo;<?php echo esc_html( get_search_query() ); ?>&rdquo;</h1>
	</div>
</section>

<section class="blog">
	<div class="container">
		<?php if ( have_posts() ) : ?>
			<div class="blog__grid">
				<?php while ( have_posts() ) : the_post(); ?>
					<article class="blog__card reveal">
						<div class="blog__body">
							<span class="eyebrow"><?php echo esc_html( get_post_type_object( get_post_type() )->labels->singular_name ?? 'Post' ); ?></span>
							<h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
							<p><?php echo esc_html( get_the_excerpt() ); ?></p>
							<a href="<?php the_permalink(); ?>" class="blog__more">Read more</a>
						</div>
					</article>
				<?php endwhile; ?>
			</div>
			<nav class="blog__pagination"><?php the_posts_pagination(); ?></nav>
		<?php else : ?>
			<p>Nothing found. Try a different search.</p>
			<?php get_search_form(); ?>
		<?php endif; ?>
	</div>
</section>

<?php get_footer(); ?>
