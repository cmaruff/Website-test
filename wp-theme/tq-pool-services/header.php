<?php
/**
 * Header template — DOCTYPE through opening of main content.
 */
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#0E6E94">
	<link rel="icon" type="image/svg+xml" href="<?php echo esc_url( TQPS_URI . '/assets/favicon.svg' ); ?>">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="nav">
	<div class="container nav__inner">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="nav__logo">
			<span class="nav__logo-mark"></span>
			<?php echo esc_html( tqps_setting( 'biz_name', 'TQ Pools' ) ); ?>
		</a>
		<nav>
			<?php
			if ( has_nav_menu( 'primary' ) ) {
				wp_nav_menu( [
					'theme_location' => 'primary',
					'menu_class'     => 'nav__links',
					'container'      => false,
				] );
			} else {
				echo '<ul class="nav__links">';
				echo '<li><a href="' . esc_url( home_url( '/' ) ) . '">Home</a></li>';
				echo '<li><a href="' . esc_url( home_url( '/services/' ) ) . '">Services &amp; prices</a></li>';
				echo '<li><a href="' . esc_url( home_url( '/products/' ) ) . '">Shop</a></li>';
				echo '<li><a href="' . esc_url( home_url( '/blog/' ) ) . '">Blog</a></li>';
				echo '<li><a href="' . esc_url( home_url( '/contact/' ) ) . '">Contact</a></li>';
				echo '</ul>';
			}
			?>
		</nav>
		<div class="nav__cta">
			<a href="tel:<?php echo esc_attr( tqps_setting( 'biz_phone', '+61400000000' ) ); ?>" class="btn btn-ghost">Call us</a>
			<a href="<?php echo esc_url( home_url( '/book/' ) ); ?>" class="btn btn-primary">Book online</a>
		</div>
		<button class="nav__burger" aria-label="Menu"><span></span><span></span><span></span></button>
	</div>
</header>
