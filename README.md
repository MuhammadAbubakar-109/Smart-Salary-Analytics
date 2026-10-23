## SmartSalary Analytics

### AI-Powered Employee Salary Prediction & Compensation Analytics

SmartSalary Analytics is a full-stack machine learning application that predicts employee salaries using a trained machine learning model. Built with FastAPI, Joblib, React, and TypeScript, it combines a Python-based prediction API with an interactive frontend for salary estimation and analytical insights.

### Features
Salary Prediction: Predict estimated employee salaries using a trained machine learning model.
Interactive Prediction Interface: Enter employee attributes through a React-based interface.
Analytics Dashboard: Explore salary-related insights through a dedicated analysis page.
FastAPI Backend: Provide API endpoints for communication between the frontend and prediction model.
Model Persistence: Use Joblib to save and load trained machine learning models.
Model Training: Train the prediction model using the backend training pipeline.
API Testing: Test backend endpoints to verify API functionality.

### Tech Stack

#### Backend

Python
FastAPI
Joblib
Machine Learning
REST API

#### Frontend

React
TypeScript
CSS

#### Project Structure
SmartSalary-Analytics/
├── backend/
│   ├── main.py
│   ├── app.py
│   ├── train.py
│   └── test_api.py
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── PredictPage.tsx
│       ├── AnalysisPage.tsx
│       └── style.css
│
└── README.md

#### Project Objectives
Develop an end-to-end salary prediction application.
Integrate a trained machine learning model with a FastAPI backend.
Build a responsive and interactive frontend using React and TypeScript.
Present salary predictions and relevant analytical insights.
Demonstrate the practical application of machine learning in HR analytics.

#### How It Works
Employee information is entered through the frontend.
The React application sends the prediction request to the FastAPI backend.
The backend loads the trained model using Joblib.
The model processes the input and generates a salary estimate.
The predicted result is returned to the frontend for display.

License

A license can be added to define the terms under which this project may be used and distributed.
