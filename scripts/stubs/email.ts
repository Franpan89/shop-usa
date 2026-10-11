export const sent: string[] = [];
const rec = (name: string) => async (arg: unknown) => {
  sent.push(`${name}:${JSON.stringify(arg).slice(0, 80)}`);
};
export const sendPaymentApprovedEmail = rec('paymentApproved');
export const sendPaymentRejectedEmail = rec('paymentRejected');
export const sendShippedEmail = rec('shipped');
export const sendReadyForPickupEmail = rec('readyForPickup');
export const sendRetentionAlertEmail = rec('retention');
