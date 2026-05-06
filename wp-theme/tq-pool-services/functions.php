<?php
/**
 * TQ Pool Services theme bootstrap.
 *
 * Loads theme support, asset enqueues, custom post types, and ACF
 * field group registrations. All Phase 2 integrations (Square, QBO,
 * SMS, iCal) live in Supabase Edge Functions; this theme only POSTs
 * to those endpoints, it does not host them.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'TQPS_VERSION', '1.0.0' );
define( 'TQPS_DIR', get_template_directory() );
define( 'TQPS_URI', get_template_directory_uri() );

/**
 * Supabase config. Override these in wp-config.php.
 *
 * Example:
 *   define( 'TQPS_SUPABASE_URL', 'https://xxxx.supabase.co' );
 *   define( 'TQPS_SUPABASE_ANON_KEY', 'eyJ...' );
 *   define( 'TQPS_DEMO_MODE', false );
 */
if ( ! defined( 'TQPS_SUPABASE_URL' ) )      define( 'TQPS_SUPABASE_URL', '' );
if ( ! defined( 'TQPS_SUPABASE_ANON_KEY' ) ) define( 'TQPS_SUPABASE_ANON_KEY', '' );
if ( ! defined( 'TQPS_DEMO_MODE' ) )         define( 'TQPS_DEMO_MODE', true );

require_once TQPS_DIR . '/inc/post-types.php';
require_once TQPS_DIR . '/inc/acf-fields.php';
require_once TQPS_DIR . '/inc/helpers.php';

add_action( 'after_setup_theme', function () {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', [ 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ] );
	add_theme_support( 'custom-logo' );
	register_nav_menus( [
		'primary' => __( 'Primary navigation', 'tqps' ),
		'footer'  => __( 'Footer navigation', 'tqps' ),
	] );
} );

add_action( 'wp_enqueue_scripts', function () {
	$css = TQPS_URI . '/assets/css';
	$js  = TQPS_URI . '/assets/js';
	$v   = TQPS_VERSION;

	wp_enqueue_style( 'tqps-tokens', "$css/tokens.css", [], $v );
	wp_enqueue_style( 'tqps-base',   "$css/base.css",   [ 'tqps-tokens' ], $v );

	if ( is_front_page() )       wp_enqueue_style( 'tqps-home',     "$css/home.css",     [ 'tqps-base' ], $v );
	if ( is_page( 'services' ) ) wp_enqueue_style( 'tqps-services', "$css/services.css", [ 'tqps-base' ], $v );
	if ( is_page( 'book' ) )     wp_enqueue_style( 'tqps-book',     "$css/book.css",     [ 'tqps-base' ], $v );
	if ( is_page( 'contact' ) )  wp_enqueue_style( 'tqps-contact',  "$css/contact.css",  [ 'tqps-base' ], $v );
	if ( is_page( 'products' ) ) wp_enqueue_style( 'tqps-products', "$css/products.css", [ 'tqps-base' ], $v );
	if ( is_singular( 'post' ) || is_home() || is_archive() || is_search() ) {
		wp_enqueue_style( 'tqps-blog', "$css/blog.css", [ 'tqps-base' ], $v );
	}
	wp_enqueue_style( 'tqps-drop', "$css/drop.css", [ 'tqps-base' ], $v );

	// Supabase config — exposed to JS so the existing supabase-config.js can read it.
	wp_register_script( 'tqps-config', '', [], $v, false );
	wp_enqueue_script( 'tqps-config' );
	wp_add_inline_script( 'tqps-config', 'window.__TQPS__ = ' . wp_json_encode( [
		'supabaseUrl'  => TQPS_SUPABASE_URL,
		'supabaseKey'  => TQPS_SUPABASE_ANON_KEY,
		'demoMode'     => (bool) TQPS_DEMO_MODE,
		'restNonce'    => wp_create_nonce( 'wp_rest' ),
		'themeUri'     => TQPS_URI,
	] ) . ';', 'after' );

	wp_enqueue_script( 'tqps-business', "$js/business-info.js", [ 'tqps-config' ], $v, true );
	wp_enqueue_script( 'tqps-supabase', "$js/supabase-config.js", [ 'tqps-config' ], $v, true );
	wp_enqueue_script( 'tqps-mock',     "$js/mock-supabase.js",   [ 'tqps-config' ], $v, true );
	wp_enqueue_script( 'tqps-main',     "$js/main.js",            [ 'tqps-config' ], $v, true );
	wp_enqueue_script( 'tqps-drop',     "$js/drop.js",            [ 'tqps-config' ], $v, true );

	if ( is_front_page() ) {
		wp_enqueue_script( 'tqps-hero-ripple', "$js/hero-ripple.js", [ 'tqps-main' ], $v, true );
	}
	if ( is_page( 'services' ) ) {
		wp_enqueue_script( 'tqps-services',     "$js/services-page.js", [ 'tqps-main' ], $v, true );
		wp_enqueue_script( 'tqps-services-pool', "$js/services-pool.js", [ 'tqps-main' ], $v, true );
	}
	if ( is_page( 'book' ) ) {
		wp_enqueue_script( 'tqps-booking', "$js/booking.js", [ 'tqps-main' ], $v, true );
	}
	if ( is_page( 'contact' ) ) {
		wp_enqueue_script( 'tqps-contact', "$js/contact.js", [ 'tqps-main' ], $v, true );
	}
	if ( is_page( 'products' ) ) {
		wp_enqueue_script( 'tqps-products', "$js/products.js", [ 'tqps-main' ], $v, true );
		wp_enqueue_script( 'tqps-cart',     "$js/cart.js",     [ 'tqps-main' ], $v, true );
	}
	if ( is_page( 'cart' ) ) {
		wp_enqueue_script( 'tqps-cart-page', "$js/cart-page.js", [ 'tqps-main' ], $v, true );
	}
	if ( is_singular( 'post' ) || is_home() ) {
		wp_enqueue_script( 'tqps-blog', "$js/blog.js", [ 'tqps-main' ], $v, true );
	}

	if ( TQPS_DEMO_MODE ) {
		wp_enqueue_script( 'tqps-demo-banner', "$js/demo-banner.js", [ 'tqps-main' ], $v, true );
	}
} );

/**
 * Make the search form simpler so it works with Inter Tight + base.css.
 */
add_filter( 'get_search_form', function () {
	return '<form role="search" method="get" class="search-form" action="' . esc_url( home_url( '/' ) ) . '">'
		. '<label class="screen-reader-text" for="s">' . esc_html__( 'Search', 'tqps' ) . '</label>'
		. '<input type="search" id="s" name="s" placeholder="' . esc_attr__( 'Search', 'tqps' ) . '" value="' . esc_attr( get_search_query() ) . '">'
		. '<button type="submit" class="btn btn-primary">' . esc_html__( 'Search', 'tqps' ) . '</button>'
		. '</form>';
} );

/**
 * Disable the Gutenberg block-editor styles on the front-end — we have our own.
 */
add_action( 'wp_enqueue_scripts', function () {
	wp_dequeue_style( 'wp-block-library' );
	wp_dequeue_style( 'wp-block-library-theme' );
	wp_dequeue_style( 'global-styles' );
}, 100 );
