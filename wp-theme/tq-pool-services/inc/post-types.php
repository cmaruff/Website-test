<?php
/**
 * Custom post types for editable content lists.
 * Using CPTs (instead of ACF Pro repeaters) means everything works
 * on ACF Free.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'init', function () {

	register_post_type( 'tqps_testimonial', [
		'labels' => [
			'name'          => __( 'Testimonials', 'tqps' ),
			'singular_name' => __( 'Testimonial', 'tqps' ),
			'add_new_item'  => __( 'Add testimonial', 'tqps' ),
			'edit_item'     => __( 'Edit testimonial', 'tqps' ),
		],
		'public'       => false,
		'show_ui'      => true,
		'show_in_menu' => true,
		'menu_icon'    => 'dashicons-format-quote',
		'menu_position'=> 25,
		'supports'     => [ 'title', 'editor', 'thumbnail' ],
		'has_archive'  => false,
	] );

	register_post_type( 'tqps_faq', [
		'labels' => [
			'name'          => __( 'FAQs', 'tqps' ),
			'singular_name' => __( 'FAQ', 'tqps' ),
		],
		'public'       => false,
		'show_ui'      => true,
		'show_in_menu' => true,
		'menu_icon'    => 'dashicons-editor-help',
		'menu_position'=> 26,
		'supports'     => [ 'title', 'editor', 'page-attributes' ],
		'hierarchical' => false,
	] );

	register_post_type( 'tqps_pricing', [
		'labels' => [
			'name'          => __( 'Pricing tiers', 'tqps' ),
			'singular_name' => __( 'Pricing tier', 'tqps' ),
		],
		'public'       => false,
		'show_ui'      => true,
		'show_in_menu' => true,
		'menu_icon'    => 'dashicons-tag',
		'menu_position'=> 27,
		'supports'     => [ 'title', 'page-attributes' ],
	] );

	register_post_type( 'tqps_product', [
		'labels' => [
			'name'          => __( 'Products', 'tqps' ),
			'singular_name' => __( 'Product', 'tqps' ),
		],
		'public'       => true,
		'show_ui'      => true,
		'show_in_menu' => true,
		'menu_icon'    => 'dashicons-cart',
		'menu_position'=> 28,
		'has_archive'  => false,
		'rewrite'      => [ 'slug' => 'shop' ],
		'supports'     => [ 'title', 'editor', 'thumbnail', 'excerpt' ],
	] );

	register_post_type( 'tqps_service', [
		'labels' => [
			'name'          => __( 'Service tiles', 'tqps' ),
			'singular_name' => __( 'Service tile', 'tqps' ),
		],
		'public'       => false,
		'show_ui'      => true,
		'show_in_menu' => true,
		'menu_icon'    => 'dashicons-admin-tools',
		'menu_position'=> 24,
		'supports'     => [ 'title', 'editor', 'page-attributes' ],
	] );
} );
