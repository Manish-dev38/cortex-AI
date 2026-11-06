/**
 * Credits are clawed back in proportion to the money refunded. The result is
 * capped by the credits that were actually granted, so a partial refund can
 * never revoke more than the order produced. Calculated server-side only;
 * the client never supplies this number.
 */
export function creditsToRevokeForRefund({ credits, amountTotal, refundAmount }) {
    const granted = Number(credits) || 0;
    const total = Number(amountTotal) || 0;
    const refund = Number(refundAmount) || 0;

    if (granted <= 0 || total <= 0 || refund <= 0) return 0;

    const clampedRefund = Math.min(refund, total);
    return Math.min(granted, Math.round((granted * clampedRefund) / total));
}

export function isFullyRefunded({ refundAmount, amountTotal }) {
    const total = Number(amountTotal) || 0;
    const refunded = Number(refundAmount) || 0;
    return total > 0 && refunded >= total;
}
