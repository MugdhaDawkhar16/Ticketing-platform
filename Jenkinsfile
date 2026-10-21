pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Validate lockfiles') {
            steps {
                sh 'test -f frontend/package-lock.json'
                sh 'test -f services/event-service/package-lock.json'
                sh 'test -f services/payment-service/package-lock.json'
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh 'docker build -t ticketflow-frontend:ci ./frontend'
            }
        }

        stage('Build Event Service Image') {
            steps {
                sh 'docker build -t ticketflow-event-service:ci ./services/event-service'
            }
        }

        stage('Build Payment Service Image') {
            steps {
                sh 'docker build -t ticketflow-payment-service:ci ./services/payment-service'
            }
        }
    }

    post {
        success {
            echo 'All three TicketFlow Docker images built successfully.'
        }
        failure {
            echo 'TicketFlow CI failed. Review the stage logs above.'
        }
    }
}
