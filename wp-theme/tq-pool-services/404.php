<?php
get_header();
?>

<section class="page-head">
	<div class="container" style="text-align:center">
		<span class="eyebrow">Not found</span>
		<h1>That page has dried up.</h1>
		<p class="page-head__lede">The link you followed doesn't go anywhere on this site. Try the homepage or get in touch.</p>
		<div class="hero__cta" style="justify-content:center; margin-top:2rem">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="btn btn-accent btn-lg">Back home</a>
			<a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>" class="btn btn-ghost btn-lg">Contact us</a>
		</div>
	</div>
</section>

<?php get_footer(); ?>
