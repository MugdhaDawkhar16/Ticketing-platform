
pipeline {
    agent {
        label 'ticketflow-windows'
    }

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
                bat 'if not exist frontend\\package-lock.json exit /b 1'
                bat 'if not exist services\\event-service\\package-lock.json exit /b 1'
                bat 'if not exist services\\payment-service\\package-lock.json exit /b 1'
            }
        }

        stage('Build Frontend Image') {
            steps {
                bat 'docker build -t ticketflow-frontend:ci ./frontend'
            }
        }

        stage('Build Event Service Image') {
            steps {
                bat 'docker build -t ticketflow-event-service:ci ./services/event-service'
            }
        }

        stage('Build Payment Service Image') {
            steps {
                bat 'docker build -t ticketflow-payment-service:ci ./services/payment-service'
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
