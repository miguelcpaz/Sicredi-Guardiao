"""Smoke test script for Sicredi Guardiao V2."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Health check
r = client.get('/health')
assert r.status_code == 200, f'Health failed: {r.text}'
print('OK Health check')

# Login as joao
r = client.post('/api/v1/auth/login', json={'username': 'joao', 'password': 'sicredi123'})
assert r.status_code == 200, f'Login failed: {r.text}'
token = r.json()['access_token']
print('OK Login:', r.json()['full_name'])

# Prepare scenario C (ensure João has enough balance)
r_prep = client.post('/api/v1/simulator/scenario/C',
    headers={'Authorization': 'Bearer ' + token}  # will fail - need analyst token first
)
# Use analyst token for scenario prep
r_ana = client.post('/api/v1/auth/login', json={'username': 'ana.ferreira', 'password': 'sicredi123'})
token_ana = r_ana.json()['access_token']
r_prep = client.post('/api/v1/simulator/scenario/C', headers={'Authorization': 'Bearer ' + token_ana})
assert r_prep.status_code == 200, f'Scenario prep failed: {r_prep.text}'
print('OK Scenario C prepared (balance boosted to R$15000)')

# PIX transfer - high risk (R$8500 to unknown recipient)
r = client.post('/api/v1/pix/transfer',
    json={'pix_key': 'invest@rapid.com', 'recipient_name': 'Investimentos Rapidos LTDA', 'amount': '8500.00'},
    headers={'Authorization': 'Bearer ' + token}
)
assert r.status_code == 201, f'PIX failed: {r.text}'
body = r.json()
screen = body['result_screen']
score = body.get('risk_score')
print(f'OK PIX result: {screen} (score: {score})')
assert screen in ('blocked', 'retained'), f'Expected blocked/retained, got: {screen}'

# Dashboard
r = client.get('/api/v1/dashboard/associate', headers={'Authorization': 'Bearer ' + token})
assert r.status_code == 200
bal = r.json()['balance']
print(f'OK Dashboard: balance={bal}')

# Ana Ferreira login
r2 = client.post('/api/v1/auth/login', json={'username': 'ana.ferreira', 'password': 'sicredi123'})
token2 = r2.json()['access_token']

# Check alerts in Ana's wallet
r3 = client.get('/api/v1/analyst/alerts', headers={'Authorization': 'Bearer ' + token2})
assert r3.status_code == 200
alerts = r3.json()
print(f'OK Ana Ferreira sees {len(alerts)} alert(s)')

# Wallet isolation - Ana should NOT see Beatriz (Roberto's wallet)
r4 = client.get('/api/v1/wallet/associates', headers={'Authorization': 'Bearer ' + token2})
assert r4.status_code == 200
names = [a['full_name'] for a in r4.json()]
print(f'OK Wallet associates: {names}')
assert 'Beatriz Santos' not in names, 'FAIL: Wallet isolation broken!'
assert 'Joao Oliveira' in [n.encode('ascii', 'ignore').decode() for n in names] or any('Jo' in n for n in names), f'Joao should be in Ana wallet, got: {names}'

# Notification endpoint
r5 = client.get('/api/v1/notifications', headers={'Authorization': 'Bearer ' + token})
assert r5.status_code == 200
notifs = r5.json()
print(f'OK Notifications for joao: {len(notifs)}')

# Simulator scenarios
r6 = client.get('/api/v1/simulator/scenarios', headers={'Authorization': 'Bearer ' + token2})
assert r6.status_code == 200
scenarios = r6.json()
print(f'OK Simulator scenarios: {[s["id"] for s in scenarios]}')

print()
print('=== ALL SMOKE TESTS PASSED ===')
