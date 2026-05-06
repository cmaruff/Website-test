<?php
/**
 * Template Name: Services & Prices
 * Slug: services
 */
get_header();
?>

<section class="page-head">
	<div class="container">
		<span class="eyebrow">Services &amp; pricing</span>
		<h1><?php echo esc_html( get_the_title() ); ?></h1>
		<?php if ( $excerpt = get_the_excerpt() ) : ?>
			<p class="page-head__lede"><?php echo esc_html( $excerpt ); ?></p>
		<?php endif; ?>
	</div>
</section>

<?php if ( get_the_content() ) : ?>
<section class="prose">
	<div class="container">
		<div class="prose__inner reveal">
			<div class="prose__text">
				<?php while ( have_posts() ) : the_post(); the_content(); endwhile; ?>
			</div>
			<figure class="prose__media" aria-label="Top-down illustration of a typical backyard pool">
				<svg class="prose-pool" viewBox="0 0 360 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
					<defs>
						<linearGradient id="proseWater" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7dd3fc"/><stop offset="55%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/></linearGradient>
						<linearGradient id="proseDeck"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f5efe6"/><stop offset="100%" stop-color="#e7dccb"/></linearGradient>
						<pattern id="proseShimmer" width="42" height="42" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><path d="M0 21 Q10 15 21 21 T42 21" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.2" stroke-linecap="round"/></pattern>
					</defs>
					<rect x="0" y="0" width="360" height="460" fill="url(#proseDeck)"/>
					<rect x="50" y="70" width="260" height="340" rx="22" ry="22" fill="url(#proseWater)"/>
					<rect x="50" y="70" width="260" height="340" rx="22" ry="22" fill="url(#proseShimmer)" opacity="0.4"/>
					<rect x="46" y="66" width="268" height="348" rx="26" ry="26" fill="none" stroke="#f8f4ec" stroke-width="6"/>
					<rect x="46" y="66" width="268" height="348" rx="26" ry="26" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
					<g stroke="#f8f4ec" stroke-width="3.5" stroke-linecap="round" fill="none">
						<line x1="170" y1="64" x2="170" y2="92"/>
						<line x1="190" y1="64" x2="190" y2="92"/>
						<path d="M170 64 q10 -6 20 0" stroke-width="3"/>
					</g>
				</svg>
				<figcaption class="prose__media-cap">A typical Townsville backyard pool.</figcaption>
			</figure>
		</div>
	</div>
</section>
<?php endif; ?>

<!-- ============ PRICING ============ -->
<section class="pricing" data-drop-stage="pricing-glide">
	<div class="container">
		<div class="section-head section-head--start reveal">
			<span class="eyebrow">Pricing</span>
			<h2>Flat rates. No surprises.</h2>
			<p>Standard residential pool. Larger pools, troubled water and equipment repairs are quoted on site.</p>
		</div>
		<div class="pricing__table-wrap reveal">
			<table class="pricing__table">
				<thead>
					<tr>
						<th>Service</th>
						<th>With chemicals</th>
						<th>Without chemicals</th>
					</tr>
				</thead>
				<tbody>
				<?php
				$tiers = tqps_pricing_tiers();
				if ( ! empty( $tiers ) ) {
					foreach ( $tiers as $t ) {
						$slug = get_field( 'svc_slug', $t->ID );
						$with = get_field( 'price_with', $t->ID );
						$without = get_field( 'price_without', $t->ID );
						printf(
							'<tr data-svc="%s"><td><strong>%s</strong>%s</td><td data-price-with>%s</td><td data-price-without>%s</td></tr>',
							esc_attr( $slug ),
							esc_html( $t->post_title ),
							get_field( 'price_blurb', $t->ID ) ? '<small>' . esc_html( get_field( 'price_blurb', $t->ID ) ) . '</small>' : '',
							esc_html( $with ),
							esc_html( $without )
						);
					}
				} else {
					echo '<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--sand-500)">Add Pricing tiers in WordPress admin to populate this table.</td></tr>';
				}
				?>
				</tbody>
			</table>
		</div>
	</div>
</section>

<!-- ============ FAQ ============ -->
<?php $faqs = tqps_faqs(); if ( ! empty( $faqs ) ) : ?>
<section class="faq" data-drop-tip="faq">
	<div class="container">
		<div class="section-head section-head--start reveal">
			<span class="eyebrow">Frequently asked</span>
			<h2>The questions we get most.</h2>
		</div>
		<div class="faq__list reveal">
		<?php foreach ( $faqs as $f ) : ?>
			<details>
				<summary><?php echo esc_html( $f->post_title ); ?></summary>
				<p><?php echo wp_kses_post( $f->post_content ); ?></p>
			</details>
		<?php endforeach; ?>
		</div>
	</div>
</section>
<?php endif; ?>

<section class="cta-final">
	<div class="container">
		<div class="cta-final__card reveal">
			<h2>Ready to book?</h2>
			<p>Pick a slot, pay your deposit, done.</p>
			<a href="<?php echo esc_url( home_url( '/book/' ) ); ?>" class="btn btn-accent btn-lg">Book a pool service</a>
		</div>
	</div>
</section>

<?php get_footer(); ?>
