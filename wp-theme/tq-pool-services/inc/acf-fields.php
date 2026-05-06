<?php
/**
 * Register ACF field groups in PHP so the client doesn't have to
 * import a JSON file or click them in by hand.
 *
 * Requires: Advanced Custom Fields (free) plugin active.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'acf/init', function () {

	if ( ! function_exists( 'acf_add_local_field_group' ) ) return;

	/* ------------------------------------------------------------
	   Theme Settings — global business info, hero copy, contact
	   ------------------------------------------------------------ */
	if ( function_exists( 'acf_add_options_page' ) ) {
		acf_add_options_page( [
			'page_title' => __( 'TQ Pool Services settings', 'tqps' ),
			'menu_title' => __( 'Site settings', 'tqps' ),
			'menu_slug'  => 'tqps-settings',
			'capability' => 'manage_options',
			'icon_url'   => 'dashicons-admin-customizer',
			'position'   => 22,
		] );
	}

	acf_add_local_field_group( [
		'key'    => 'group_tqps_settings',
		'title'  => 'Site settings',
		'fields' => [
			[ 'key' => 'tqps_biz_name',    'label' => 'Business name',    'name' => 'biz_name',    'type' => 'text',     'default_value' => 'TQ Pool Services' ],
			[ 'key' => 'tqps_biz_phone',   'label' => 'Phone',            'name' => 'biz_phone',   'type' => 'text' ],
			[ 'key' => 'tqps_biz_email',   'label' => 'Email',            'name' => 'biz_email',   'type' => 'email' ],
			[ 'key' => 'tqps_biz_hours',   'label' => 'Hours',            'name' => 'biz_hours',   'type' => 'text' ],
			[ 'key' => 'tqps_biz_address', 'label' => 'Service area note','name' => 'biz_address', 'type' => 'text' ],
			[ 'key' => 'tqps_biz_abn',     'label' => 'ABN',              'name' => 'biz_abn',     'type' => 'text' ],
		],
		'location' => [ [ [ 'param' => 'options_page', 'operator' => '==', 'value' => 'tqps-settings' ] ] ],
	] );

	/* ------------------------------------------------------------
	   Front page — hero + section copy
	   ------------------------------------------------------------ */
	acf_add_local_field_group( [
		'key'    => 'group_tqps_home',
		'title'  => 'Home page',
		'fields' => [
			[ 'key' => 'tqps_hero_badge',    'label' => 'Hero badge',    'name' => 'hero_badge',    'type' => 'text',     'default_value' => 'Mobile pool service · Townsville' ],
			[ 'key' => 'tqps_hero_h1_a',     'label' => 'Hero H1 — line 1','name' => 'hero_h1_a',   'type' => 'text',     'default_value' => 'Sparkling pools,' ],
			[ 'key' => 'tqps_hero_h1_b',     'label' => 'Hero H1 — line 2 (accent)','name' => 'hero_h1_b','type' => 'text','default_value' => 'zero hassle.' ],
			[ 'key' => 'tqps_hero_lede',     'label' => 'Hero lede',     'name' => 'hero_lede',     'type' => 'textarea' ],
			[ 'key' => 'tqps_hero_cta_primary_label', 'label' => 'Primary CTA label', 'name' => 'hero_cta_primary_label', 'type' => 'text', 'default_value' => 'Book a pool service' ],
			[ 'key' => 'tqps_hero_cta_primary_url',   'label' => 'Primary CTA URL',   'name' => 'hero_cta_primary_url',   'type' => 'url',  'default_value' => '/book' ],
			[ 'key' => 'tqps_hero_cta_secondary_label', 'label' => 'Secondary CTA label', 'name' => 'hero_cta_secondary_label', 'type' => 'text', 'default_value' => 'See services & prices' ],
			[ 'key' => 'tqps_hero_cta_secondary_url',   'label' => 'Secondary CTA URL',   'name' => 'hero_cta_secondary_url',   'type' => 'url',  'default_value' => '/services' ],
			[ 'key' => 'tqps_photo_grid',  'label' => 'Recent visits photo grid', 'name' => 'photo_grid', 'type' => 'gallery' ],
		],
		'location' => [ [ [ 'param' => 'page_type', 'operator' => '==', 'value' => 'front_page' ] ] ],
	] );

	/* ------------------------------------------------------------
	   Pricing tier — fields for each pricing CPT entry
	   ------------------------------------------------------------ */
	acf_add_local_field_group( [
		'key'    => 'group_tqps_pricing',
		'title'  => 'Pricing tier details',
		'fields' => [
			[ 'key' => 'tqps_price_with',    'label' => 'Price (with chemicals)',    'name' => 'price_with',    'type' => 'text' ],
			[ 'key' => 'tqps_price_without', 'label' => 'Price (without chemicals)', 'name' => 'price_without', 'type' => 'text' ],
			[ 'key' => 'tqps_svc_slug',      'label' => 'Service key',               'name' => 'svc_slug',      'type' => 'text', 'instructions' => 'Used for data-svc attribute on the pricing row (weekly / fortnightly / 4weekly / oneoff)' ],
			[ 'key' => 'tqps_price_blurb',   'label' => 'Tagline',                   'name' => 'price_blurb',   'type' => 'text' ],
		],
		'location' => [ [ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'tqps_pricing' ] ] ],
	] );

	/* ------------------------------------------------------------
	   Product — Square checkout link + price fields
	   ------------------------------------------------------------ */
	acf_add_local_field_group( [
		'key'    => 'group_tqps_product',
		'title'  => 'Product details',
		'fields' => [
			[ 'key' => 'tqps_product_price',         'label' => 'Price (cents)',            'name' => 'price_cents',     'type' => 'number' ],
			[ 'key' => 'tqps_product_square_id',     'label' => 'Square catalog item ID',   'name' => 'square_item_id',  'type' => 'text' ],
			[ 'key' => 'tqps_product_in_stock',      'label' => 'In stock',                 'name' => 'in_stock',        'type' => 'true_false', 'default_value' => 1 ],
			[ 'key' => 'tqps_product_short',         'label' => 'Short description',        'name' => 'short_desc',      'type' => 'textarea' ],
		],
		'location' => [ [ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'tqps_product' ] ] ],
	] );

	/* ------------------------------------------------------------
	   Service tile — extra fields for each service preview
	   ------------------------------------------------------------ */
	acf_add_local_field_group( [
		'key'    => 'group_tqps_service',
		'title'  => 'Service tile details',
		'fields' => [
			[ 'key' => 'tqps_service_icon', 'label' => 'Icon (svg snippet)', 'name' => 'svc_icon', 'type' => 'textarea', 'instructions' => 'Paste raw SVG for the icon.' ],
			[ 'key' => 'tqps_service_link', 'label' => 'CTA link',           'name' => 'svc_link', 'type' => 'url' ],
		],
		'location' => [ [ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'tqps_service' ] ] ],
	] );

	/* ------------------------------------------------------------
	   Testimonial — suburb + role
	   ------------------------------------------------------------ */
	acf_add_local_field_group( [
		'key'    => 'group_tqps_testimonial',
		'title'  => 'Testimonial details',
		'fields' => [
			[ 'key' => 'tqps_test_suburb', 'label' => 'Suburb', 'name' => 'suburb', 'type' => 'text' ],
			[ 'key' => 'tqps_test_role',   'label' => 'Role',   'name' => 'role',   'type' => 'text', 'instructions' => 'e.g. "Weekly customer since 2024"' ],
		],
		'location' => [ [ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'tqps_testimonial' ] ] ],
	] );

} );
