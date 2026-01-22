import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  username: string;
  groups: string[];
}

export class AuthHelper {
  private static verifier: any;

  static initialize(userPoolId: string, clientId: string): void {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId,
    });
  }

  static async verifyToken(token: string): Promise<AuthenticatedUser> {
    if (!this.verifier) {
      throw new Error('AuthHelper not initialized');
    }

    try {
      const payload = await this.verifier.verify(token);
      
      return {
        userId: payload.sub,
        email: payload.email,
        username: payload.username,
        groups: payload['cognito:groups'] || [],
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static extractTokenFromEvent(event: APIGatewayProxyEvent): string | null {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    
    if (!authHeader) {
      return null;
    }

    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return authHeader;
  }

  static async authenticateEvent(event: APIGatewayProxyEvent): Promise<AuthenticatedUser> {
    const token = this.extractTokenFromEvent(event);
    
    if (!token) {
      throw new Error('No authorization token provided');
    }

    return await this.verifyToken(token);
  }
}
