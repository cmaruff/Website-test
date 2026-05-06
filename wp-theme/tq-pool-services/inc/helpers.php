<?php
/**
 * Template helpers for the TQ Pool Services theme.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Safe ACF getter with fallback.
 */
function tqps_field( $name, $default = '', $post_id = null ) {
	if ( ! function_exists( 'get_field' ) ) return $default;
	$v = get_field( $name, $post_id );
	return ( $v === false || $v === null || $v === '' ) ? $default : $v;
}

/**
 * Site-settings getter (ACF options page).
 */
function tqps_setting( $name, $default = '' ) {
	if ( ! function_exists( 'get_field' ) ) return $default;
	$v = get_field( $name, 'option' );
	return ( $v === false || $v === null || $v === '' ) ? $default : $v;
}

/**
 * Pricing tiers — sorted by menu_order.
 */
function tqps_pricing_tiers() {
	return get_posts( [
		'post_type'      => 'tqps_pricing',
		'posts_per_page' => -1,
		'orderby'        => 'menu_order',
		'order'          => 'ASC',
	] );
}

function tqps_testimonials( $limit = 3 ) {
	return get_posts( [
		'post_type'      => 'tqps_testimonial',
		'posts_per_page' => $limit,
		'orderby'        => 'date',
		'order'          => 'DESC',
	] );
}

function tqps_faqs() {
	return get_posts( [
		'post_type'      => 'tqps_faq',
		'posts_per_page' => -1,
		'orderby'        => 'menu_order',
		'order'          => 'ASC',
	] );
}

function tqps_services() {
	return get_posts( [
		'post_type'      => 'tqps_service',
		'posts_per_page' => -1,
		'orderby'        => 'menu_order',
		'order'          => 'ASC',
	] );
}

function tqps_products() {
	return get_posts( [
		'post_type'      => 'tqps_product',
		'posts_per_page' => -1,
		'orderby'        => 'date',
		'order'          => 'DESC',
	] );
}

/**
 * Format price cents (int) -> "$45.00"
 */
function tqps_price_format( $cents ) {
	if ( ! is_numeric( $cents ) ) return '';
	return '$' . number_format( ( (int) $cents ) / 100, 2 );
}

/**
 * Resolve a Supabase Edge Function URL.
 */
function tqps_edge_function_url( $name ) {
	$base = trim( TQPS_SUPABASE_URL );
	if ( ! $base ) return '';
	return rtrim( $base, '/' ) . '/functions/v1/' . $name;
}
