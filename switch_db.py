#!/usr/bin/env python3
"""
Database switching utility for HealthClub project.
This script helps you easily switch between SQLite and PostgreSQL.
"""

import os
import sys

def switch_to_sqlite():
    """Switch to SQLite database"""
    with open('config.env', 'r') as f:
        lines = f.readlines()
    
    with open('config.env', 'w') as f:
        for line in lines:
            if line.startswith('DJANGO_DB='):
                f.write('DJANGO_DB=sqlite\n')
            else:
                f.write(line)
    
    print("✅ Switched to SQLite database")
    print("📁 Database file: db.sqlite3")

def switch_to_postgres():
    """Switch to PostgreSQL database"""
    with open('config.env', 'r') as f:
        lines = f.readlines()
    
    with open('config.env', 'w') as f:
        for line in lines:
            if line.startswith('DJANGO_DB='):
                f.write('DJANGO_DB=postgres\n')
            else:
                f.write(line)
    
    print("✅ Switched to PostgreSQL database")
    print("🐘 Make sure PostgreSQL is running and configured correctly")

def show_current_db():
    """Show current database configuration"""
    with open('config.env', 'r') as f:
        for line in f:
            if line.startswith('DJANGO_DB='):
                db_type = line.strip().split('=')[1]
                if db_type == 'sqlite':
                    print("📁 Current database: SQLite (db.sqlite3)")
                elif db_type == 'postgres':
                    print("🐘 Current database: PostgreSQL")
                else:
                    print(f"❓ Current database: {db_type}")
                break

def main():
    if len(sys.argv) != 2:
        print("Usage: python switch_db.py [sqlite|postgres|status]")
        print("\nCommands:")
        print("  sqlite   - Switch to SQLite database")
        print("  postgres - Switch to PostgreSQL database")
        print("  status   - Show current database configuration")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == 'sqlite':
        switch_to_sqlite()
    elif command == 'postgres':
        switch_to_postgres()
    elif command == 'status':
        show_current_db()
    else:
        print(f"❌ Unknown command: {command}")
        print("Use: sqlite, postgres, or status")
        sys.exit(1)

if __name__ == "__main__":
    main()
