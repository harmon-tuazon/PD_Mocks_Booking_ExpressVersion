/************************************************************************************************
 * Node.js 20.x
 * HubSpot Workflow Custom Code
 *
 * --- Master Financial Adjustment Handler (v29 - Lookup by Name) ---
 *
 * Workflow Trigger: Deal-based, when 'Initiate Adjustment?' is true.
 *
 * Purpose:
 * This version updates all lookup logic to use the line item 'name' instead of
 * 'hs_sku' or 'hs_product_code', aligning with the user's operational process.
 *
 ************************************************************************************************/

const axios = require('axios');

// --- ❗ ACTION REQUIRED: CONFIGURE YOUR IDS AND INTERNAL NAMES HERE ❗ ---

// --- SECRETS ---
const HUBSPOT_API_TOKEN = process.env.HS_TOKEN; // Your HubSpot Private App Token

// --- OBJECT TYPE IDS ---
const OBJECT_TYPE_DEAL = 'deals';
const OBJECT_TYPE_LINE_ITEM = '0-8';
const OBJECT_TYPE_CREDIT_NOTE = '2-41609496';
const OBJECT_TYPE_ENROLLMENT = '2-41701559';
const OBJECT_TYPE_TRANSACTION = '2-47045790';
const OBJECT_TYPE_NOTE = 'notes';
const OBJECT_TYPE_PRODUCT = '0-7';

// --- PROPERTY INTERNAL NAMES ---
const DEAL_PROP_ADJUSTMENT_TYPE = 'adjustment_type';
const DEAL_PROP_ADJUSTMENT_AMOUNT = 'adjustment_amount';
const DEAL_PROP_LINE_ITEM_ID = 'line_item_id_to_adjust';
const DEAL_PROP_COURSE_CODE_FOR_TRANSFER = 'course_code_for_transfer_process';
const DEAL_PROP_CREDIT_NOTE_TO_APPLY = 'record_id_of_credit_note_to_apply';
const DEAL_PROP_ADJUSTMENT_REASON = 'adjustment_reason';
const DEAL_PROP_OWNER_ID = 'hubspot_owner_id';
const DEAL_PROP_DEALNAME = 'dealname';
const DEAL_PROP_CREDITS_APPLIED = 'credits_applied';
const DEAL_PROP_TOTAL_TRANSACTIONS = 'total_transactions'; 
const ADJUST_PENALTY = 'adjustment_penalty'
const UPDATED_BY = 'hs_updated_by_user_id'

// --- PIPELINE & STAGE IDS ---
const ENROLLMENT_STAGE_WITHDRAWN = '1103959830';
const ENROLLMENT_STAGE_TRANSFERRED = '1108001401';
const DEAL_STAGE_NEW_TRANSFER = '1043431960';

// --- ASSOCIATION DEFINITION IDS ---
const ASSOC_ID_DEAL_TO_CREDIT_NOTE = '1133'; 
const ASSOC_ID_DEAL_TO_TRANSACTION = '1136';
const ASSOC_ID_CREDIT_NOTE_TO_TRANSACTION = '1134';
const ASSOC_ID_DEAL_TO_DEAL_TRANSFERRED_FROM = '1137';
const ASSOC_ID_DEAL_TO_DEAL_TRANSFERRED_TO = '1138';
const ASSOC_ID_NOTE_TO_DEAL = '214'; 


// --- END OF CONFIGURATION ---

const HUBSPOT_API_URL = 'https://api.hubapi.com';

/**
 * A centralized function to make authenticated API calls to HubSpot.
 */
async function hubspotApiCall(method, url, data = null) {
    try {
        const response = await axios({
            method,
            url: `${HUBSPOT_API_URL}${url}`,
            data,
            headers: {
                'Authorization': `Bearer ${HUBSPOT_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        console.error(`API Call Failed: ${method.toUpperCase()} ${url}`);
        if (error.response) {
            console.error('Error Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
        throw error;
    }
}

/**
 * --- UPDATED HELPER FUNCTION ---
 * A reusable function to update the status of line items and their corresponding enrollments.
 */
async function updateLineItemsAndEnrollments(lineItemIds, newStatus, newStageId) {
    if (!lineItemIds || lineItemIds.length === 0) return;

    console.log(`Updating status for ${lineItemIds.length} line item(s) to '${newStatus}'.`);

    for (const lineItemId of lineItemIds) {
        const lineItemDetails = await hubspotApiCall('get', `/crm/v3/objects/${OBJECT_TYPE_LINE_ITEM}/${lineItemId}?properties=line_item_status,name`);
        const lineItemName = lineItemDetails.properties.name || `ID ${lineItemId}`;
        
        if (lineItemDetails.properties.line_item_status === 'Withdrawn' || lineItemDetails.properties.line_item_status === 'Transferred') {
            throw new Error(`Line Item "${lineItemName}" has already been processed. Cannot process a second adjustment.`);
        }

        await hubspotApiCall('patch', `/crm/v3/objects/${OBJECT_TYPE_LINE_ITEM}/${lineItemId}`, {
            properties: { line_item_status: newStatus }
        });
        console.log(`  - Updated Line Item ${lineItemId} status to '${newStatus}'.`);

        const enrollmentSearch = await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_ENROLLMENT}/search`, {
            filterGroups: [{ filters: [{ propertyName: 'associated_line_item_id', operator: 'EQ', value: lineItemId }] }]
        });

        if (enrollmentSearch.results && enrollmentSearch.results.length > 0) {
            const enrollmentId = enrollmentSearch.results[0].id;
            await hubspotApiCall('patch', `/crm/v3/objects/${OBJECT_TYPE_ENROLLMENT}/${enrollmentId}`, {
                properties: { 
                    hs_pipeline_stage: newStageId,
                    enrollment_status: newStatus
                }
            });
            console.log(`  - Updated Enrollment ${enrollmentId} stage and status to '${newStatus}'.`);
        } else {
            console.warn(`  - No matching enrollment found for Line Item ${lineItemId}.`);
        }
    }
}


/**
 * Recalculates and updates the deal amount based on all associated line items.
 */
async function recalculateAndUpdateDealAmount(dealId) {
    console.log(`Recalculating deal amount for Deal ID: ${dealId}`);

    // Fetch all line items associated with the deal
    const lineItemsAssoc = await hubspotApiCall('get', `/crm/v4/objects/deals/${dealId}/associations/line_items`);

    if (!lineItemsAssoc.results || lineItemsAssoc.results.length === 0) {
        console.log('  - No line items found, setting deal amount to 0');
        await hubspotApiCall('patch', `/crm/v3/objects/deals/${dealId}`, {
            properties: { amount: 0 }
        });
        return;
    }

    // Fetch details for each line item to get their prices
    let totalAmount = 0;
    for (const lineItemAssoc of lineItemsAssoc.results) {
        const lineItemId = lineItemAssoc.toObjectId;
        const lineItemDetails = await hubspotApiCall('get', `/crm/v3/objects/${OBJECT_TYPE_LINE_ITEM}/${lineItemId}?properties=price,quantity`);
        const price = parseFloat(lineItemDetails.properties.price || '0');
        const quantity = parseFloat(lineItemDetails.properties.quantity || '1');
        totalAmount += (price * quantity);
    }

    console.log(`  - Calculated total amount: ${totalAmount}`);

    // Update the deal's amount property
    await hubspotApiCall('patch', `/crm/v3/objects/deals/${dealId}`, {
        properties: { amount: totalAmount }
    });

    console.log(`  - Updated deal amount to ${totalAmount}`);
}

/**
 * Main function executed by the HubSpot workflow.
 */
exports.main = async (event, callback) => {
    const dealId = event.inputFields.hs_object_id;
    const adjustmentType = event.inputFields[DEAL_PROP_ADJUSTMENT_TYPE];
    const adjustmentAmount = parseFloat(event.inputFields[DEAL_PROP_ADJUSTMENT_AMOUNT] || '0');
    let lineItemIdToAdjust = event.inputFields[DEAL_PROP_LINE_ITEM_ID];
    const courseCodeForTransfer = event.inputFields[DEAL_PROP_COURSE_CODE_FOR_TRANSFER];
    const creditNoteToApplyId = event.inputFields[DEAL_PROP_CREDIT_NOTE_TO_APPLY];
    const adjustmentReason = event.inputFields[DEAL_PROP_ADJUSTMENT_REASON];
    const dealOwnerId = event.inputFields[DEAL_PROP_OWNER_ID];
    const dealName = event.inputFields[DEAL_PROP_DEALNAME];
	const penalty = event.inputFields[ADJUST_PENALTY];

    let status = 'SUCCESS';
    let summaryMessage = `Adjustment '${adjustmentType}' processed successfully.`;
    let ownerName = 'an administrator';

    try {
        if (!dealId || !adjustmentType) {
            throw new Error(`FATAL: Missing required inputs from workflow. Deal ID: ${dealId}, Adjustment Type: ${adjustmentType}.`);
        }
        
        if (dealOwnerId) {
            const ownerDetails = await hubspotApiCall('get', `/crm/v3/owners/${dealOwnerId}`);
            ownerName = `${ownerDetails.firstName} ${ownerDetails.lastName}`;
        }

        console.log(`🚀 Starting Adjustment Process for Deal ID: ${dealId}`);
        console.log(`   - Type: ${adjustmentType}`);

        const propertiesToFetch = `${DEAL_PROP_CREDITS_APPLIED},${DEAL_PROP_TOTAL_TRANSACTIONS}`;
        const dealDetails = await hubspotApiCall('get', `/crm/v3/objects/deals/${dealId}?properties=${propertiesToFetch}`);
        const currentCreditsApplied = parseFloat(dealDetails.properties[DEAL_PROP_CREDITS_APPLIED] || '0');
        const totalTransactions = parseFloat(dealDetails.properties[DEAL_PROP_TOTAL_TRANSACTIONS] || '0');

        switch (adjustmentType) {
            case 'Generate Credit':
                if (totalTransactions <= 0) throw new Error(`Cannot generate credit. Total transaction value on this deal is 0.`);
                if (adjustmentAmount > totalTransactions) throw new Error(`Cannot generate credit of ${adjustmentAmount}. Total transaction value is only ${totalTransactions}.`);

                let lineItemIdsToCredit = [];
                if (lineItemIdToAdjust && lineItemIdToAdjust.toLowerCase().trim() === 'all') {
                    const allLineItemsAssoc = await hubspotApiCall('get', `/crm/v4/objects/deals/${dealId}/associations/line_items`);
                    if (!allLineItemsAssoc.results || allLineItemsAssoc.results.length === 0) throw new Error("No line items found on this deal to process.");
                    lineItemIdsToCredit = allLineItemsAssoc.results.map(res => res.toObjectId);
                } else if (lineItemIdToAdjust) {
                    let finalLineItemId = lineItemIdToAdjust;
                    if (isNaN(parseInt(lineItemIdToAdjust))) {
                        // UPDATED: Search by 'name' instead of 'hs_sku'
                        const searchPayload = {
                            filterGroups: [{ filters: [{ propertyName: 'name', operator: 'EQ', value: lineItemIdToAdjust }, { propertyName: 'associations.deal', operator: 'EQ', value: dealId }] }],
                            properties: ["hs_object_id"], limit: 1
                        };
                        const searchResult = await hubspotApiCall('post', `/crm/v3/objects/line_items/search`, searchPayload);
                        if (searchResult.results && searchResult.results.length > 0) {
                            finalLineItemId = searchResult.results[0].id;
                        } else {
                            throw new Error(`Could not find a line item with Name "${lineItemIdToAdjust}" associated with this deal.`);
                        }
                    }
                    lineItemIdsToCredit.push(finalLineItemId);
                }
                
                await updateLineItemsAndEnrollments(lineItemIdsToCredit, 'Withdrawn', ENROLLMENT_STAGE_WITHDRAWN);

                const creditAmount = adjustmentAmount;
                const newCreditNote = await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_CREDIT_NOTE}`, {
                    properties: { 
                        credit_total: creditAmount, credit_balance: creditAmount, status: 'Active', 
                        credit_note_name: `Credit from ${dealName}`, type: 'Credits on File',
                        note: adjustmentReason, deal_record_id: dealId
                    }
                });

                await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_TRANSACTION}`, {
                    properties: {
                        transaction_type: 'Credit Issued', transaction_amount: -Math.abs(creditAmount),
                        transaction_date: new Date().setUTCHours(0, 0, 0, 0), description_reason: adjustmentReason,
                        transaction_name: `Credit Issued from ${dealName}`, associated_deal_id: dealId,
                        associated_credit_note_id: newCreditNote.id
                    }
                });

                // Recalculate deal amount based on line items
                await recalculateAndUpdateDealAmount(dealId);

                // Apply penalty/adjustment deduction directly to deal amount (HubSpot doesn't allow negative line item prices)
                const penaltyValue = parseFloat(penalty) || 0;
                const totalDeduction = adjustmentAmount + penaltyValue;

                if (totalDeduction > 0) {
                    const updatedDeal = await hubspotApiCall('get', `/crm/v3/objects/deals/${dealId}?properties=amount`);
                    const currentAmount = parseFloat(updatedDeal.properties.amount || '0');
                    const newAmount = currentAmount - totalDeduction;

                    await hubspotApiCall('patch', `/crm/v3/objects/deals/${dealId}`, {
                        properties: { amount: Math.max(0, newAmount) }  // Ensure amount doesn't go negative
                    });
                    console.log(`  - Applied penalty/adjustment deduction of -${totalDeduction} (adjustment: ${adjustmentAmount}, penalty: ${penaltyValue}). New deal amount: ${Math.max(0, newAmount)}`);
                }

                const newCreditsApplied = currentCreditsApplied - Math.abs(creditAmount);
                await hubspotApiCall('patch', `/crm/v3/objects/deals/${dealId}`, { properties: { [DEAL_PROP_CREDITS_APPLIED]: newCreditsApplied } });
                break;

            case 'Apply Existing Credit':
                if (!creditNoteToApplyId) throw new Error("Credit Note ID to apply is required.");
                
                const creditNote = await hubspotApiCall('get', `/crm/v3/objects/${OBJECT_TYPE_CREDIT_NOTE}/${creditNoteToApplyId}?properties=credit_balance`);
                const currentBalance = parseFloat(creditNote.properties.credit_balance);
                if (currentBalance < adjustmentAmount) throw new Error(`Cannot apply ${adjustmentAmount}. Credit note only has ${currentBalance} available.`);
                
                const newBalance = currentBalance - adjustmentAmount;
                await hubspotApiCall('patch', `/crm/v3/objects/${OBJECT_TYPE_CREDIT_NOTE}/${creditNoteToApplyId}`, {
                    properties: { credit_balance: newBalance, status: newBalance === 0 ? 'Fully Used' : 'Partially Used' }
                });

                await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_TRANSACTION}`, {
                    properties: {
                        transaction_type: 'Credit Utilized', transaction_amount: Math.abs(adjustmentAmount),
                        transaction_date: new Date().setUTCHours(0, 0, 0, 0), description_reason: adjustmentReason,
                        transaction_name: `Credit Utilized on ${dealName}`, associated_deal_id: dealId,
                        associated_credit_note_id: creditNoteToApplyId
                    }
                });

                const newCreditsAppliedUtilized = currentCreditsApplied + Math.abs(adjustmentAmount);
                await hubspotApiCall('patch', `/crm/v3/objects/deals/${dealId}`, { properties: { [DEAL_PROP_CREDITS_APPLIED]: newCreditsAppliedUtilized } });
                break;

            case 'Refund':
                if (totalTransactions <= 0) throw new Error(`Cannot issue refund. Total transaction value on this deal is ${totalTransactions}.`);
                if (adjustmentAmount > totalTransactions) throw new Error(`Cannot refund ${adjustmentAmount}. Total transaction value is only ${totalTransactions}.`);

                let lineItemIdsToRefund = [];
                if (lineItemIdToAdjust && lineItemIdToAdjust.toLowerCase().trim() === 'all') {
                    const allLineItemsAssoc = await hubspotApiCall('get', `/crm/v4/objects/deals/${dealId}/associations/line_items`);
                    if (!allLineItemsAssoc.results || allLineItemsAssoc.results.length === 0) throw new Error("No line items found on this deal to process.");
                    lineItemIdsToRefund = allLineItemsAssoc.results.map(res => res.toObjectId);
                } else if (lineItemIdToAdjust) {
                    let finalLineItemId = lineItemIdToAdjust;
                     if (isNaN(parseInt(lineItemIdToAdjust))) {
                        // UPDATED: Search by 'name' instead of 'hs_sku'
                        const searchPayload = {
                            filterGroups: [{ filters: [{ propertyName: 'name', operator: 'EQ', value: lineItemIdToAdjust }, { propertyName: 'associations.deal', operator: 'EQ', value: dealId }] }],
                            properties: ["hs_object_id"], limit: 1
                        };
                        const searchResult = await hubspotApiCall('post', `/crm/v3/objects/line_items/search`, searchPayload);
                        if (searchResult.results && searchResult.results.length > 0) {
                            finalLineItemId = searchResult.results[0].id;
                        } else {
                            throw new Error(`Could not find a line item with Name "${lineItemIdToAdjust}" associated with this deal.`);
                        }
                    }
                    lineItemIdsToRefund.push(finalLineItemId);
                }

                await updateLineItemsAndEnrollments(lineItemIdsToRefund, 'Withdrawn', ENROLLMENT_STAGE_WITHDRAWN);
                
                const refundCreditNote = await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_CREDIT_NOTE}`, {
                    properties: {
                        credit_total: adjustmentAmount, credit_balance: 0, status: 'Pending Approval',
                        credit_note_name: `Refund for ${dealName}`, type: 'Refund',
                        note: adjustmentReason, deal_record_id: dealId
                    }
                });
                
                await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_TRANSACTION}`, {
                    properties: {
                        transaction_type: 'Refund', transaction_amount: -Math.abs(adjustmentAmount),
                        transaction_date: new Date().setUTCHours(0, 0, 0, 0), description_reason: adjustmentReason,
                        transaction_name: `Refund from ${dealName}`, associated_deal_id: dealId,
                        associated_credit_note_id: refundCreditNote.id
                    }
                });

                // Recalculate deal amount based on line items
                await recalculateAndUpdateDealAmount(dealId);

                // Apply penalty/adjustment deduction directly to deal amount (HubSpot doesn't allow negative line item prices)
                const penaltyValue2 = parseFloat(penalty) || 0;
                const totalDeduction2 = adjustmentAmount + penaltyValue2;

                if (totalDeduction2 > 0) {
                    const updatedDeal2 = await hubspotApiCall('get', `/crm/v3/objects/deals/${dealId}?properties=amount`);
                    const currentAmount2 = parseFloat(updatedDeal2.properties.amount || '0');
                    const newAmount2 = currentAmount2 - totalDeduction2;

                    await hubspotApiCall('patch', `/crm/v3/objects/deals/${dealId}`, {
                        properties: { amount: Math.max(0, newAmount2) }  // Ensure amount doesn't go negative
                    });
                    console.log(`  - Applied penalty/adjustment deduction of -${totalDeduction2} (adjustment: ${adjustmentAmount}, penalty: ${penaltyValue2}). New deal amount: ${Math.max(0, newAmount2)}`);
                }

                const newCreditsAppliedRefund = currentCreditsApplied - Math.abs(adjustmentAmount);
                await hubspotApiCall('patch', `/crm/v3/objects/deals/${dealId}`, { properties: { [DEAL_PROP_CREDITS_APPLIED]: newCreditsAppliedRefund } });

                await hubspotApiCall('post', '/crm/v3/objects/tasks', {
                    properties: {
                        hs_task_subject: `Process Refund for Deal: ${dealName}`,
                        hs_task_body: `A refund credit note has been created and requires approval. Please review Credit Note ID ${refundCreditNote.id} and process a cash refund of ${adjustmentAmount}. Reason: ${adjustmentReason}.`,
                        hs_task_status: 'NOT_STARTED', hubspot_owner_id: dealOwnerId,
                        hs_task_priority: 'HIGH', hs_timestamp: new Date().setUTCHours(0, 0, 0, 0)
                    }
                });
                break;

            case 'Transfer':
                if (!lineItemIdToAdjust || lineItemIdToAdjust.toLowerCase().trim() === 'all') {
                    throw new Error("A specific Line Item ID/Name to transfer FROM is required.");
                }
                if (!courseCodeForTransfer) {
                    throw new Error("A 'Course Code for Transfer Process' (the Name of the new course) is required.");
                }

                await updateLineItemsAndEnrollments([lineItemIdToAdjust], 'Transferred', ENROLLMENT_STAGE_TRANSFERRED);

                const newDeal = await hubspotApiCall('post', `/crm/v3/objects/deals`, {
                    properties: {
                        dealname: `${dealName} - Transfer to ${courseCodeForTransfer}`,
                        amount: adjustmentAmount,
                        dealstage: DEAL_STAGE_NEW_TRANSFER,
                        hubspot_owner_id: dealOwnerId
                    }
                });

                // UPDATED: Search by 'name' instead of 'hs_product_code'
                const productSearch = await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_PRODUCT}/search`, {
                    filterGroups: [{ filters: [{ propertyName: 'name', operator: 'EQ', value: courseCodeForTransfer }] }],
                    properties: ["name", "price"], limit: 1
                });
                if (!productSearch.results || productSearch.results.length === 0) {
                    throw new Error(`Could not find a product with Name: ${courseCodeForTransfer}`);
                }
                const newProduct = productSearch.results[0];

                const newLineItem = await hubspotApiCall('post', `/crm/v3/objects/line_items`, {
                    properties: {
                        name: newProduct.properties.name,
                        hs_product_id: newProduct.id,
                        quantity: 1,
                        price: newProduct.properties.price
                    }
                });
                await hubspotApiCall('put', `/crm/v3/objects/line_items/${newLineItem.id}/associations/deals/${newDeal.id}/line_item_to_deal`);

                await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_TRANSACTION}`, {
                    properties: {
                        transaction_type: 'Transfer Out',
                        transaction_amount: -Math.abs(adjustmentAmount),
                        transaction_name: `Transfer Out from ${dealName}`,
                        associated_deal_id: dealId
                    }
                });
                
                await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_TRANSACTION}`, {
                    properties: {
                        transaction_type: 'Transfer In',
                        transaction_amount: Math.abs(adjustmentAmount),
                        transaction_name: `Transfer In to ${newDeal.properties.dealname}`,
                        associated_deal_id: newDeal.id
                    }
                });

                const originalDealCredits = currentCreditsApplied - Math.abs(adjustmentAmount);
                await hubspotApiCall('patch', `/crm/v3/objects/deals/${dealId}`, { properties: { [DEAL_PROP_CREDITS_APPLIED]: originalDealCredits } });
                
                console.log('✅ Successfully processed transfer.');
                break;

            default:
                summaryMessage = `No action defined for type: ${adjustmentType}`;
        }

    } catch (error) {
        status = 'FAIL';
        summaryMessage = error.message;
        console.error('🔥 An error occurred during the workflow execution.', error);
    } finally {
        const lastUpdatedBy = event.inputFields[UPDATED_BY] || ownerName || 'Unknown User';
        const noteBody = `
            <p>An adjustment request initiated by <strong>${lastUpdatedBy}</strong> has been processed.</p>
            <ul>
                <li><strong>Status:</strong> ${status === 'SUCCESS' ? '✅ Success' : '❌ Failure'}</li>
                <li><strong>Action Type:</strong> ${adjustmentType || 'N/A'}</li>
                ${lineItemIdToAdjust ? `<li><strong>Targeted Line Item:</strong> ${lineItemIdToAdjust}</li>` : ''}
                ${courseCodeForTransfer ? `<li><strong>New Course Code:</strong> ${courseCodeForTransfer}</li>` : ''}
                <li><strong>Summary:</strong> ${summaryMessage}</li>
            </ul>
        `;
        
        try {
            const notePayload = {
                properties: { hs_note_body: noteBody, hs_timestamp: new Date().getTime(), hs_attachment_ids: "" },
                associations: [{ to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: ASSOC_ID_NOTE_TO_DEAL }] }]
            };
            await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_NOTE}`, notePayload);
            console.log(`✅ Created summary note on Deal ID ${dealId}.`);
        } catch (noteError) {
            console.error('CRITICAL: Failed to create summary note.', noteError);
        }

        callback({ outputFields: { hs_execution_state: status } });
    }
};
