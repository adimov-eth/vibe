// XLN Demo App - Making the Innovation Visceral
const API_BASE = 'http://localhost:3001/api';

// App State
let currentView = 'merchant';
let currentMerchant = null;
let currentCustomer = null;
let merchants = [];

// View Management
document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        showView(view);
    });
});

function showView(view) {
    // Update buttons
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    // Update views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${view}-view`).classList.add('active');
    
    currentView = view;
    
    // Refresh data for current view
    if (view === 'hub') {
        refreshHubStats();
    } else if (view === 'merchant' && currentMerchant) {
        refreshMerchantDashboard();
    } else if (view === 'customer' && currentCustomer) {
        refreshCustomerDashboard();
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Merchant Registration
document.getElementById('merchant-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('merchant-name').value;
    const creditLimit = document.getElementById('credit-limit').value;
    
    try {
        const response = await fetch(`${API_BASE}/merchants/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                requestedCreditLimit: creditLimit
            })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            currentMerchant = result.data;
            showMerchantDashboard();
            showToast(`🎉 ${name} can now accept $${creditLimit} with ZERO deposit!`);
            
            // Generate QR code
            generateMerchantQR(currentMerchant.id);
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
});

// Customer Registration
document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('customer-name').value;
    const deposit = document.getElementById('initial-deposit').value;
    
    try {
        const response = await fetch(`${API_BASE}/customers/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                initialDeposit: deposit
            })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            currentCustomer = result.data;
            showCustomerDashboard();
            showToast(`Welcome ${name}! You have $${deposit} to spend.`);
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
});

// Show Dashboards
function showMerchantDashboard() {
    document.getElementById('merchant-register').classList.add('hidden');
    document.getElementById('merchant-dashboard').classList.remove('hidden');
    
    updateMerchantDisplay();
}

function showCustomerDashboard() {
    document.getElementById('customer-register').classList.add('hidden');
    document.getElementById('customer-dashboard').classList.remove('hidden');
    
    updateCustomerDisplay();
}

// Update Displays
function updateMerchantDisplay() {
    if (!currentMerchant) return;
    
    document.getElementById('merchant-display-name').textContent = currentMerchant.name;
    document.querySelector('.merchant-id').textContent = `ID: ${currentMerchant.id}`;
    
    const available = parseFloat(currentMerchant.availableToReceive);
    const received = parseFloat(currentMerchant.balance);
    
    document.getElementById('available-credit').textContent = `$${available.toFixed(2)}`;
    document.getElementById('total-received').textContent = `$${received.toFixed(2)}`;
}

function updateCustomerDisplay() {
    if (!currentCustomer) return;
    
    document.getElementById('customer-display-name').textContent = currentCustomer.name;
    document.getElementById('customer-balance').textContent = `$${parseFloat(currentCustomer.balance).toFixed(2)}`;
}

// Generate QR Code
function generateMerchantQR(merchantId) {
    const canvas = document.getElementById('merchant-qr');
    if (typeof QRCode !== 'undefined') {
        QRCode.toCanvas(canvas, merchantId, {
            width: 200,
            margin: 2,
            color: {
                dark: '#5B21B6',
                light: '#FFFFFF'
            }
        });
    }
}

// Send Payment
async function sendPayment() {
    const merchantAddress = document.getElementById('merchant-address').value;
    const amount = document.getElementById('payment-amount').value;
    
    if (!currentCustomer || !merchantAddress || !amount) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: currentCustomer.id,
                to: merchantAddress,
                amount: amount
            })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            showToast(`✅ Sent $${amount} successfully!`);
            
            // Clear form
            document.getElementById('merchant-address').value = '';
            document.getElementById('payment-amount').value = '';
            
            // Refresh data
            refreshCustomerDashboard();
            
            // If we're paying ourselves (demo), refresh merchant too
            if (currentMerchant && merchantAddress === currentMerchant.id) {
                refreshMerchantDashboard();
            }
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Payment failed', 'error');
    }
}

// Refresh Functions
async function refreshMerchantDashboard() {
    if (!currentMerchant) return;
    
    // Get updated merchant data
    const response = await fetch(`${API_BASE}/merchants`);
    const result = await response.json();
    
    if (result.ok) {
        const merchant = result.data.find(m => m.id === currentMerchant.id);
        if (merchant) {
            currentMerchant = merchant;
            updateMerchantDisplay();
        }
    }
    
    // Get payments
    const paymentsResponse = await fetch(`${API_BASE}/payments`);
    const paymentsResult = await paymentsResponse.json();
    
    if (paymentsResult.ok) {
        const merchantPayments = paymentsResult.data
            .filter(p => p.to === currentMerchant.id)
            .slice(-5)
            .reverse();
            
        displayPayments(merchantPayments, 'merchant-payments');
    }
}

async function refreshCustomerDashboard() {
    if (!currentCustomer) return;
    
    // For demo, recalculate balance based on payments
    const paymentsResponse = await fetch(`${API_BASE}/payments`);
    const paymentsResult = await paymentsResponse.json();
    
    if (paymentsResult.ok) {
        const customerPayments = paymentsResult.data
            .filter(p => p.from === currentCustomer.id);
            
        const spent = customerPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        currentCustomer.balance = parseFloat(currentCustomer.balance) - spent;
        currentCustomer.totalSpent = spent;
        
        updateCustomerDisplay();
        
        const recentPayments = customerPayments.slice(-5).reverse();
        displayPayments(recentPayments, 'customer-payments', true);
    }
}

async function refreshHubStats() {
    try {
        // Get hub stats
        const statsResponse = await fetch(`${API_BASE}/hub/stats`);
        const statsResult = await statsResponse.json();
        
        if (statsResult.ok) {
            const stats = statsResult.data;
            document.getElementById('capital-efficiency').textContent = `${stats.capitalEfficiency}x`;
            document.getElementById('total-credit').textContent = `$${parseFloat(stats.totalCreditExtended).toLocaleString()}`;
            document.getElementById('hub-reserves').textContent = `$${parseFloat(stats.reservesRequired).toLocaleString()}`;
            document.getElementById('merchant-count').textContent = stats.merchantCount;
        }
        
        // Get merchants
        const merchantsResponse = await fetch(`${API_BASE}/merchants`);
        const merchantsResult = await merchantsResponse.json();
        
        if (merchantsResult.ok) {
            displayMerchants(merchantsResult.data);
        }
    } catch (error) {
        console.error('Error refreshing hub stats:', error);
    }
}

// Display Functions
function displayPayments(payments, elementId, isOutgoing = false) {
    const container = document.getElementById(elementId);
    
    if (payments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6B7280;">No payments yet</p>';
        return;
    }
    
    container.innerHTML = payments.map(p => {
        const time = new Date(p.timestamp).toLocaleTimeString();
        return `
            <div class="payment-item">
                <div>
                    <div class="payment-amount">${isOutgoing ? '-' : '+'}$${parseFloat(p.amount).toFixed(2)}</div>
                    <div class="payment-time">${time}</div>
                </div>
                <div style="text-align: right; font-size: 12px; color: #6B7280;">
                    ${isOutgoing ? `To: ${p.to}` : `From: ${p.from}`}
                </div>
            </div>
        `;
    }).join('');
}

function displayMerchants(merchants) {
    const container = document.getElementById('merchants-list');
    
    container.innerHTML = merchants.map(m => `
        <div class="merchant-card">
            <h4>${m.name}</h4>
            <div class="merchant-stats">
                <div>
                    <div style="color: #6B7280; font-size: 12px;">Credit Line</div>
                    <div style="font-weight: 600;">$${parseFloat(m.creditLimit).toLocaleString()}</div>
                </div>
                <div>
                    <div style="color: #6B7280; font-size: 12px;">Received</div>
                    <div style="font-weight: 600; color: #10B981;">$${parseFloat(m.balance).toFixed(2)}</div>
                </div>
                <div>
                    <div style="color: #6B7280; font-size: 12px;">Available</div>
                    <div style="font-weight: 600;">$${parseFloat(m.availableToReceive).toFixed(2)}</div>
                </div>
                <div>
                    <div style="color: #6B7280; font-size: 12px;">Capital Required</div>
                    <div style="font-weight: 600; color: #5B21B6;">$0</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Demo Showcase
async function runShowcase() {
    try {
        showToast('Running XLN demo...', 'success');
        
        const response = await fetch(`${API_BASE}/demo/showcase`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.ok) {
            const data = result.data;
            
            // Show results in a special toast
            const message = `
                🎉 ${data.message}
                
                ${data.innovation}
                
                Lightning: ${data.comparison.lightning.merchantDeposit}
                XLN: ${data.comparison.xln.merchantDeposit}
                
                Capital Efficiency: ${data.comparison.xln.capitalEfficiency} vs ${data.comparison.lightning.capitalEfficiency}
            `;
            
            // Create a detailed modal or extended toast
            alert(message);
            
            // Refresh hub view to show the demo results
            showView('hub');
            refreshHubStats();
        }
    } catch (error) {
        showToast('Demo error', 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Start on merchant view
    showView('merchant');
    
    // Auto-refresh hub stats every 5 seconds when on hub view
    setInterval(() => {
        if (currentView === 'hub') {
            refreshHubStats();
        }
    }, 5000);
});