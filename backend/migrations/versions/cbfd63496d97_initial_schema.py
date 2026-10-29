"""initial_schema — Complete schema for Sicredi Guardião V2

Revision ID: cbfd63496d97
Revises: 
Create Date: 2026-10-28

This migration creates the complete schema for a fresh PostgreSQL database.
For existing SQLite databases upgrading to PostgreSQL, run this migration
against an empty Neon database before importing seed data.

Tables created:
  users, associates, cards, behavior_profiles, transactions, risk_analyses,
  alerts, incidents, incident_events, notifications, audit_logs, risk_configs,
  manager_wallets, pix_transfers, chat_sessions, chat_messages,
  associate_chat_sessions, associate_chat_messages
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'cbfd63496d97'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables for a fresh database."""
    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('username', sa.String(80), unique=True, nullable=False, index=True),
        sa.Column('email', sa.String(120), unique=True, nullable=False),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('hashed_password', sa.String(200), nullable=False),
        sa.Column('role', sa.String(20), nullable=False, server_default='associate'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # associates
    # ------------------------------------------------------------------
    op.create_table(
        'associates',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), unique=True, nullable=False),
        sa.Column('account_number', sa.String(20), unique=True, nullable=False),
        sa.Column('balance', sa.Numeric(12, 2), server_default='12450.00'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # cards
    # ------------------------------------------------------------------
    op.create_table(
        'cards',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('associate_id', sa.Integer(), sa.ForeignKey('associates.id'), nullable=False),
        sa.Column('last_four', sa.String(4), nullable=False),
        sa.Column('card_type', sa.String(20), server_default='debit'),
        sa.Column('is_restricted', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # behavior_profiles
    # ------------------------------------------------------------------
    op.create_table(
        'behavior_profiles',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('associate_id', sa.Integer(), sa.ForeignKey('associates.id'), unique=True, nullable=False),
        sa.Column('avg_transaction_value', sa.Numeric(12, 2), server_default='0.00'),
        sa.Column('max_transaction_value', sa.Numeric(12, 2), server_default='0.00'),
        sa.Column('typical_hours', sa.String(200), server_default='08:00-22:00'),
        sa.Column('typical_categories', sa.Text(), server_default=''),
        sa.Column('known_merchants', sa.Text(), server_default=''),
        sa.Column('typical_locations', sa.String(200), server_default=''),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # transactions
    # ------------------------------------------------------------------
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('associate_id', sa.Integer(), sa.ForeignKey('associates.id'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('merchant', sa.String(200), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('location', sa.String(200), server_default=''),
        sa.Column('mode', sa.String(50), server_default='pix'),
        sa.Column('status', sa.String(30), nullable=False, server_default='pending_review'),
        sa.Column('device_id', sa.String(100), server_default=''),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # risk_analyses
    # ------------------------------------------------------------------
    op.create_table(
        'risk_analyses',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), unique=True, nullable=False),
        sa.Column('risk_score', sa.Integer(), nullable=False),
        sa.Column('risk_level', sa.String(20), nullable=False),
        sa.Column('risk_factors', sa.Text(), server_default=''),
        sa.Column('risk_signals', sa.Text(), server_default=''),
        sa.Column('explanation', sa.Text(), server_default=''),
        sa.Column('provider', sa.String(50), server_default='mock'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # alerts
    # ------------------------------------------------------------------
    op.create_table(
        'alerts',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=False),
        sa.Column('risk_score', sa.Integer(), nullable=False),
        sa.Column('risk_level', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('response', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # incidents
    # ------------------------------------------------------------------
    op.create_table(
        'incidents',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=False),
        sa.Column('alert_id', sa.Integer(), sa.ForeignKey('alerts.id'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('description', sa.Text(), server_default=''),
        sa.Column('resolution', sa.Text(), server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # incident_events
    # ------------------------------------------------------------------
    op.create_table(
        'incident_events',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('incident_id', sa.Integer(), sa.ForeignKey('incidents.id'), nullable=False),
        sa.Column('actor', sa.String(80), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # notifications
    # ------------------------------------------------------------------
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('alert_id', sa.Integer(), sa.ForeignKey('alerts.id'), nullable=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # audit_logs
    # ------------------------------------------------------------------
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('actor', sa.String(80), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('from_status', sa.String(50), nullable=True),
        sa.Column('to_status', sa.String(50), nullable=True),
        sa.Column('justification', sa.Text(), server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # risk_configs
    # ------------------------------------------------------------------
    op.create_table(
        'risk_configs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('rule_name', sa.String(100), unique=True, nullable=False),
        sa.Column('weight', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('description', sa.Text(), server_default=''),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # manager_wallets
    # ------------------------------------------------------------------
    op.create_table(
        'manager_wallets',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('analyst_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('associate_id', sa.Integer(), sa.ForeignKey('associates.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('analyst_id', 'associate_id', name='uq_wallet_link'),
    )

    # ------------------------------------------------------------------
    # pix_transfers
    # ------------------------------------------------------------------
    op.create_table(
        'pix_transfers',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('associate_id', sa.Integer(), sa.ForeignKey('associates.id'), nullable=False),
        sa.Column('pix_key', sa.String(140), nullable=False),
        sa.Column('recipient_name', sa.String(100), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('description', sa.String(200), server_default=''),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('initiated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # chat_sessions (analyst)
    # ------------------------------------------------------------------
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('analyst_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=True),
        sa.Column('incident_id', sa.Integer(), sa.ForeignKey('incidents.id'), nullable=True),
        sa.Column('title', sa.String(200), server_default='Nova Análise'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # chat_messages (analyst)
    # ------------------------------------------------------------------
    op.create_table(
        'chat_messages',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_sessions.id'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # associate_chat_sessions
    # ------------------------------------------------------------------
    op.create_table(
        'associate_chat_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(200), server_default='Nova Conversa'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # associate_chat_messages
    # ------------------------------------------------------------------
    op.create_table(
        'associate_chat_messages',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('associate_chat_sessions.id'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    """Drop all tables (order matters due to foreign keys)."""
    op.drop_table('associate_chat_messages')
    op.drop_table('associate_chat_sessions')
    op.drop_table('chat_messages')
    op.drop_table('chat_sessions')
    op.drop_table('pix_transfers')
    op.drop_table('manager_wallets')
    op.drop_table('risk_configs')
    op.drop_table('audit_logs')
    op.drop_table('notifications')
    op.drop_table('incident_events')
    op.drop_table('incidents')
    op.drop_table('alerts')
    op.drop_table('risk_analyses')
    op.drop_table('transactions')
    op.drop_table('behavior_profiles')
    op.drop_table('cards')
    op.drop_table('associates')
    op.drop_table('users')
