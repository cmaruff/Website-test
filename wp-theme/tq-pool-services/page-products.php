<?php
/**
 * Template Name: Products / Shop
 * Slug: products
 */
get_header();
?>

<section class="page-head">
	<div class="container">
		<span class="eyebrow">Shop</span>
		<h1><?php echo esc_html( get_the_title() ?: 'Pool care basics, delivered locally' ); ?></h1>
		<p class="page-head__lede"><?php echo esc_html( get_the_excerpt() ?: 'Real same-week dispatch across Townsville. Free local delivery over $80.' ); ?></p>
	</div>
</section>

<section class="products">
	<div class="container">
		<div class="products__grid" id="products-grid">
		<?php
		$products = tqps_products();
		if ( ! empty( $products ) ) {
			foreach ( $products as $p ) {
				$price       = (int) get_field( 'price_cents', $p->ID );
				$square_id   = get_field( 'square_item_id', $p->ID );
				$in_stock    = (bool) get_field( 'in_stock', $p->ID );
				$short       = get_field( 'short_desc', $p->ID );
				$thumb       = get_the_post_thumbnail_url( $p->ID, 'medium' );
				?>
				<article class="product-card" data-product-id="<?php echo esc_attr( $p->ID ); ?>" data-square-id="<?php echo esc_attr( $square_id ); ?>">
					<?php if ( $thumb ) : ?>
						<div class="product-card__media"><img src="<?php echo esc_url( $thumb ); ?>" alt="<?php echo esc_attr( $p->post_title ); ?>" loading="lazy"></div>
					<?php endif; ?>
					<h3><?php echo esc_html( $p->post_title ); ?></h3>
					<?php if ( $short ) : ?><p><?php echo esc_html( $short ); ?></p><?php endif; ?>
					<div class="product-card__row">
						<span class="product-card__price"><?php echo esc_html( tqps_price_format( $price ) ); ?></span>
						<?php if ( $in_stock ) : ?>
							<button class="btn btn-primary" data-add-to-cart>Add to cart</button>
						<?php else : ?>
							<span class="badge">Out of stock</span>
						<?php endif; ?>
					</div>
				</article>
				<?php
			}
		} else {
			echo '<p style="grid-column:1/-1;text-align:center;color:var(--sand-500);padding:3rem">No products yet — add one in WordPress admin under Products.</p>';
		}
		?>
		</div>
	</div>
</section>

<?php get_footer(); ?>
