/************************************************************************************************
 * Node.js 20.x
 * HubSpot Workflow Custom Code
 *
 * --- Simple Deal Adjustment Handler ---
 *
 * Purpose:
 * Creates a negative line item adjustment on a deal using the discount property
 * and documents it with a note.
 *
 ************************************************************************************************/

const axios = require('axios');

// --- CONFIGURATION ---
const HUBSPOT_API_TOKEN = process.env.HS_TOKEN;
const HUBSPOT_API_URL = 'https://api.hubapi.com';

// Object Type IDs
const OBJECT_TYPE_LINE_ITEM = '0-8';
const OBJECT_TYPE_NOTE = 'notes';

// Product ID for adjustment line items
const ADJUSTMENT_PRODUCT_ID = '22099387758';

// Association ID for Note to Deal
const ASSOC_ID_NOTE_TO_DEAL = '214';

/**
 * Centralized function to make authenticated API calls to HubSpot.
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
 * Main function executed by the HubSpot workflow.
 */
exports.main = async (event, callback) => {
    const dealId = event.inputFields.hs_object_id;
    const dealAdjustment = parseFloat(event.inputFields.deal_adjustment || '0');

    let status = 'SUCCESS';
    let summaryMessage = `Deal adjustment of ${dealAdjustment} processed successfully.`;

    try {
        if (!dealId) {
            throw new Error('FATAL: Missing deal ID from workflow inputs.');
        }

        if (!dealAdjustment || dealAdjustment === 0) {
            throw new Error('FATAL: Deal adjustment amount is required and must be non-zero.');
        }

        console.log(`🚀 Starting Deal Adjustment for Deal ID: ${dealId}`);
        console.log(`   - Adjustment Amount: ${dealAdjustment}`);

        // Create a negative line item using positive price with double discount
        // Example: price 100, discount 200 = net -100
        const adjustmentAmount = Math.abs(dealAdjustment); // Ensure positive for price

        const adjustmentLineItem = await hubspotApiCall('post', `/crm/v3/objects/line_items`, {
            properties: {
                name: 'Deal Adjustment',
                hs_product_id: ADJUSTMENT_PRODUCT_ID,
                quantity: 1,
                price: adjustmentAmount,
                discount: adjustmentAmount * 2  // Discount twice the price for negative effect
            }
        });

        console.log(`✅ Created adjustment line item ${adjustmentLineItem.id} with properties:`);
        console.log(`   - Price: ${adjustmentAmount}`);
        console.log(`   - Discount: ${adjustmentAmount * 2}`);
        console.log(`   - Net Effect: -${adjustmentAmount}`);

        // Associate the line item with the deal
        await hubspotApiCall(
            'put',
            `/crm/v3/objects/line_items/${adjustmentLineItem.id}/associations/deals/${dealId}/line_item_to_deal`
        );

        console.log(`✅ Associated line item ${adjustmentLineItem.id} with deal ${dealId}`);

        summaryMessage = `Successfully created adjustment line item ${adjustmentLineItem.id} with net deduction of -${adjustmentAmount}`;

    } catch (error) {
        status = 'FAIL';
        summaryMessage = error.message;
        console.error('🔥 An error occurred during the workflow execution:', error);
    } finally {
        // Create a note documenting the adjustment
        const noteBody = `
            <p><strong>Deal Adjustment Processed</strong></p>
            <ul>
                <li><strong>Status:</strong> ${status === 'SUCCESS' ? '✅ Success' : '❌ Failure'}</li>
                <li><strong>Adjustment Amount:</strong> -${Math.abs(dealAdjustment)}</li>
                <li><strong>Summary:</strong> ${summaryMessage}</li>
                <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
            </ul>
        `;

        try {
            const notePayload = {
                properties: {
                    hs_note_body: noteBody,
                    hs_timestamp: new Date().getTime()
                },
                associations: [{
                    to: { id: dealId },
                    types: [{
                        associationCategory: 'HUBSPOT_DEFINED',
                        associationTypeId: ASSOC_ID_NOTE_TO_DEAL
                    }]
                }]
            };

            await hubspotApiCall('post', `/crm/v3/objects/${OBJECT_TYPE_NOTE}`, notePayload);
            console.log(`✅ Created summary note on Deal ID ${dealId}`);
        } catch (noteError) {
            console.error('CRITICAL: Failed to create summary note:', noteError);
        }

        callback({ outputFields: { hs_execution_state: status } });
    }
};
