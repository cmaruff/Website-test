<?php
/**
 * Footer template — closing of main content + footer + script tags.
 */
?>
<footer class="footer">
	<div class="container footer__grid">
		<div>
			<h4><?php echo esc_html( tqps_setting( 'biz_name', 'TQ Pool Services' ) ); ?></h4>
			<p style="color:var(--sand-300); margin-bottom:var(--sp-4)">
				Mobile pool cleaning and servicing across Townsville and North Queensland.
			</p>
			<?php if ( $abn = tqps_setting( 'biz_abn' ) ) : ?>
				<p style="color:var(--sand-300); font-size:var(--fs-sm)">ABN: <?php echo esc_html( $abn ); ?></p>
			<?php endif; ?>
		</div>
		<div>
			<h4>Services</h4>
			<a href="<?php echo esc_url( home_url( '/services/' ) ); ?>">Regular servicing</a>
			<a href="<?php echo esc_url( home_url( '/services/' ) ); ?>">One-off cleans</a>
			<a href="<?php echo esc_url( home_url( '/services/' ) ); ?>">Green pool recovery</a>
			<a href="<?php echo esc_url( home_url( '/services/' ) ); ?>">Test &amp; balance</a>
		</div>
		<div>
			<h4>Company</h4>
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>">Home</a>
			<a href="<?php echo esc_url( home_url( '/services/' ) ); ?>">Services &amp; prices</a>
			<a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">Blog</a>
			<a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">Contact</a>
		</div>
		<div>
			<h4>Get in touch</h4>
			<?php if ( $email = tqps_setting( 'biz_email' ) ) : ?>
				<a href="mailto:<?php echo esc_attr( $email ); ?>"><?php echo esc_html( $email ); ?></a>
			<?php endif; ?>
			<?php if ( $phone = tqps_setting( 'biz_phone' ) ) : ?>
				<a href="tel:<?php echo esc_attr( $phone ); ?>"><?php echo esc_html( $phone ); ?></a>
			<?php endif; ?>
			<?php if ( $hours = tqps_setting( 'biz_hours' ) ) : ?>
				<p style="color:var(--sand-300); margin-top:var(--sp-3); font-size:var(--fs-sm)"><?php echo esc_html( $hours ); ?></p>
			<?php endif; ?>
		</div>
	</div>
	<div class="footer__base container">
		<p>&copy; <?php echo (int) date( 'Y' ); ?> <?php echo esc_html( tqps_setting( 'biz_name', 'TQ Pool Services' ) ); ?>. All rights reserved.</p>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
