#!/bin/bash

# Navigate to the project directory
cd "$(dirname "$0")"

echo "Starting Palhak Equipment Management System..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "Please create a .env file with your configuration."
    echo "See .env.example for reference."
    echo ""
    read -p "Press Enter to continue anyway or Ctrl+C to exit..."
fi

# Open browser after a delay
(sleep 3 && open http://localhost:3000) &

echo "🚀 Starting development server..."
echo "The website will open in your browser automatically."
echo ""
echo "Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the dev server
npm run dev





