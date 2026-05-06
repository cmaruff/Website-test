<?php
/**
 * Front page template — homepage.
 */
get_header();

$hero_badge   = tqps_field( 'hero_badge', 'Mobile pool service · Townsville' );
$hero_h1_a    = tqps_field( 'hero_h1_a', 'Sparkling pools,' );
$hero_h1_b    = tqps_field( 'hero_h1_b', 'zero hassle.' );
$hero_lede    = tqps_field( 'hero_lede', "TQ Pool Services is Townsville's mobile pool team. Weekly, fortnightly, 4-weekly or one-off — we come to you, with a photo and chemical report after every visit." );
$cta1_label   = tqps_field( 'hero_cta_primary_label',  'Book a pool service' );
$cta1_url     = tqps_field( 'hero_cta_primary_url',    home_url( '/book/' ) );
$cta2_label   = tqps_field( 'hero_cta_secondary_label','See services & prices' );
$cta2_url     = tqps_field( 'hero_cta_secondary_url',  home_url( '/services/' ) );
?>

<section class="hero">
	<div class="hero__bg" aria-hidden="true">
		<div class="hero__mesh"></div>
		<div class="hero__caustic"></div>
		<div class="hero__bubbles">
			<span class="hero__bubble" style="--x:12%;--s:10px;--d:11s;--delay:0s"></span>
			<span class="hero__bubble" style="--x:26%;--s:6px;--d:13s;--delay:3s"></span>
			<span class="hero__bubble" style="--x:42%;--s:12px;--d:15s;--delay:6s"></span>
			<span class="hero__bubble" style="--x:62%;--s:8px;--d:12s;--delay:2s"></span>
			<span class="hero__bubble" style="--x:78%;--s:11px;--d:14s;--delay:5s"></span>
			<span class="hero__bubble" style="--x:90%;--s:7px;--d:13s;--delay:8s"></span>
		</div>
		<svg class="hero__wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
			<path class="hero__wave-path hero__wave-path--back"  d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,120 L0,120 Z" fill="rgba(56,168,205,0.18)"/>
			<path class="hero__wave-path hero__wave-path--front" d="M0,80 C240,40 480,120 720,80 C960,40 1200,120 1440,80 L1440,120 L0,120 Z" fill="rgba(168,219,234,0.55)"/>
		</svg>
	</div>
	<div class="container hero__inner">
		<div class="hero__content reveal">
			<span class="badge"><?php echo esc_html( $hero_badge ); ?></span>
			<h1><?php echo esc_html( $hero_h1_a ); ?><br><span class="hero__accent"><?php echo esc_html( $hero_h1_b ); ?></span></h1>
			<p class="hero__lede"><?php echo esc_html( $hero_lede ); ?></p>
			<div class="hero__cta">
				<a href="<?php echo esc_url( $cta1_url ); ?>" class="btn btn-accent btn-lg"><?php echo esc_html( $cta1_label ); ?></a>
				<a href="<?php echo esc_url( $cta2_url ); ?>" class="btn btn-ghost btn-lg"><?php echo esc_html( $cta2_label ); ?></a>
			</div>
			<ul class="hero__trust">
				<li>✓ Mobile only — we travel</li>
				<li>✓ Photo + chemical report each visit</li>
				<li>✓ Locally owned, Townsville</li>
			</ul>
		</div>
	</div>
</section>

<!-- ============ SERVICES PREVIEW ============ -->
<section class="services-preview">
	<div class="container">
		<div class="section-head reveal">
			<span class="eyebrow">What we do</span>
			<h2>On a schedule that suits you.</h2>
		</div>
		<div class="services-grid">
		<?php
		$services = tqps_services();
		if ( ! empty( $services ) ) {
			$i = 0;
			foreach ( $services as $svc ) {
				$icon = get_field( 'svc_icon', $svc->ID );
				$link = get_field( 'svc_link', $svc->ID );
				printf(
					'<article class="service-card reveal" style="transition-delay:%.2fs"><span class="service-card__icon" aria-hidden="true">%s</span><h3>%s</h3>%s%s</article>',
					$i * 0.1,
					$icon ? wp_kses_post( $icon ) : '',
					esc_html( $svc->post_title ),
					$svc->post_excerpt ? '<p>' . esc_html( $svc->post_excerpt ) . '</p>' : '<p>' . wp_kses_post( $svc->post_content ) . '</p>',
					$link ? '<a class="service-card__link" href="' . esc_url( $link ) . '">Learn more</a>' : ''
				);
				$i++;
			}
		} else {
			// Hardcoded fallback so the homepage looks complete on day one.
			?>
			<article class="service-card reveal">
				<span class="service-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18M3 12h18M3 17h18"/><circle cx="7" cy="7" r="1.3"/><circle cx="13" cy="12" r="1.3"/><circle cx="9" cy="17" r="1.3"/></svg></span>
				<h3>Regular pool servicing</h3>
				<p>Weekly, fortnightly or 4-weekly visits. Full clean, chemical balance, equipment check, photo report.</p>
				<span class="service-card__price">From $58</span>
			</article>
			<article class="service-card reveal" style="transition-delay:.1s">
				<span class="service-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg></span>
				<h3>One-off pool clean</h3>
				<p>Pool needs a refresh before guests arrive? We'll get it sparkling — no contract required.</p>
				<span class="service-card__price">From $130</span>
			</article>
			<article class="service-card reveal" style="transition-delay:.2s">
				<span class="service-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4 4 6 7 6 11a6 6 0 1 1-12 0c0-4 2-7 6-11z"/><path d="M9 14a3 3 0 0 0 3 3"/></svg></span>
				<h3>Green pool recovery</h3>
				<p>Algae taken over? We'll bring your pool back to crystal clear with a tailored recovery plan.</p>
				<span class="service-card__price">Quote on site</span>
			</article>
			<article class="service-card reveal" style="transition-delay:.3s">
				<span class="service-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v5l4 8a3 3 0 0 1-3 4H8a3 3 0 0 1-3-4l4-8z"/><path d="M7 14h10"/></svg></span>
				<h3>Pool water testing &amp; balancing</h3>
				<p>Just need a chemical check? Quick visit, full water analysis, dosing recommendations.</p>
				<span class="service-card__price">From $54</span>
			</article>
			<?php
		}
		?>
		</div>
		<div class="text-center mt-6">
			<a href="<?php echo esc_url( home_url( '/services/' ) ); ?>" class="btn btn-primary">View all services and prices</a>
		</div>
	</div>
</section>

<!-- ============ TESTIMONIALS ============ -->
<section class="reviews" data-drop-tip="testimonials">
	<div class="container">
		<div class="section-head section-head--start reveal">
			<span class="eyebrow">What clients say</span>
			<h2>In their own words.</h2>
		</div>
		<div class="reviews__grid">
		<?php
		$tests = tqps_testimonials( 3 );
		if ( ! empty( $tests ) ) {
			$i = 0;
			foreach ( $tests as $t ) {
				$accent = $i === 1 ? ' quote--accent' : '';
				printf(
					'<figure class="quote%s reveal" style="transition-delay:%.2fs"><blockquote>%s</blockquote><figcaption><strong>%s</strong><span>%s</span></figcaption></figure>',
					esc_attr( $accent ),
					$i * 0.08,
					wp_kses_post( $t->post_content ),
					esc_html( $t->post_title ),
					esc_html( trim( get_field( 'suburb', $t->ID ) . ' · ' . get_field( 'role', $t->ID ), ' ·' ) )
				);
				$i++;
			}
		} else {
			?>
			<figure class="quote reveal"><blockquote>Pool was knee-deep in palm fronds after the last cyclone. They came out the next morning, sent before/after photos, and we were swimming by Friday.</blockquote><figcaption><strong>Kelly A.</strong><span>Mt Louisa · fortnightly</span></figcaption></figure>
			<figure class="quote quote--accent reveal" style="transition-delay:.08s"><blockquote>Honest pricing, no upselling. They flagged the chlorinator cell needed replacing months before it failed and saved us a green pool over Christmas.</blockquote><figcaption><strong>Marcus W.</strong><span>Kirwan · weekly</span></figcaption></figure>
			<figure class="quote reveal" style="transition-delay:.16s"><blockquote>The chemical reports they email after each visit are gold. We can see at a glance whether anything's drifting and act on it.</blockquote><figcaption><strong>Priya P.</strong><span>Idalia · 4-weekly</span></figcaption></figure>
			<?php
		}
		?>
		</div>
	</div>
</section>

<!-- ============ FINAL CTA ============ -->
<section class="cta-final">
	<div class="container">
		<div class="cta-final__card reveal">
			<h2>Ready when you are.</h2>
			<p>Book online in under two minutes — or call us if you'd rather chat.</p>
			<div class="hero__cta">
				<a href="<?php echo esc_url( home_url( '/book/' ) ); ?>" class="btn btn-accent btn-lg">Book online</a>
				<a href="tel:<?php echo esc_attr( tqps_setting( 'biz_phone', '+61400000000' ) ); ?>" class="btn btn-ghost btn-lg">Call us</a>
			</div>
		</div>
	</div>
</section>

<?php get_footer(); ?>
