import { Transaction, TransactionInput } from './types';
import { UTXOPoolManager } from './utxo-pool';
import { verify } from './utils/crypto';
import {
  ValidationResult,
  ValidationError,
  VALIDATION_ERRORS,
  createValidationError
} from './errors';

export class TransactionValidator {
  constructor(private utxoPool: UTXOPoolManager) {}

  /**
   * Validate a transaction
   * @param {Transaction} transaction - The transaction to validate
   * @returns {ValidationResult} The validation result
   */
  validateTransaction(transaction: Transaction): ValidationResult {
    const errors: ValidationError[] = []

    if (transaction.inputs.length === 0) {
      errors.push(createValidationError(
        VALIDATION_ERRORS.EMPTY_INPUTS,
        'La transacción no tiene entradas'
      ));
    }


    if (transaction.outputs.length === 0) {
      errors.push(createValidationError(
        VALIDATION_ERRORS.EMPTY_OUTPUTS,
        'La transacción no tiene salidas'
      ));
    }

    let totalInput = 0;

    for (const input of transaction.inputs) {
       const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (!utxo) {
          errors.push(createValidationError(
          VALIDATION_ERRORS.UTXO_NOT_FOUND,
          `UTXO no encontrado para txId=${input.utxoId.txId}, outputIndex=${input.utxoId.outputIndex}`
        ));
      }
      else{
       totalInput += utxo.amount;
       const txDataToSign = this.createTransactionDataForSigning_(transaction);
      const isValidSignature = verify(txDataToSign, input.signature, input.owner);
      if (!isValidSignature) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.INVALID_SIGNATURE,
          `Firma inválida para input de txId=${input.utxoId.txId}, outputIndex=${input.utxoId.outputIndex}`
        ));
      }
      }
    }

    let totalOutput = 0;
    for (const output of transaction.outputs) {
      totalOutput += output.amount;
    }

    if(totalInput != totalOutput){
        errors.push(createValidationError(
        VALIDATION_ERRORS.AMOUNT_MISMATCH,
      `Suma de entradas (${totalInput}) no coincide con suma de salidas (${totalOutput})`
        ));
    }



    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a deterministic string representation of the transaction for signing
   * This excludes the signatures to prevent circular dependencies
   * @param {Transaction} transaction - The transaction to create a data for signing
   * @returns {string} The string representation of the transaction for signing
   */
  private createTransactionDataForSigning_(transaction: Transaction): string {
    const unsignedTx = {
      id: transaction.id,
      inputs: transaction.inputs.map(input => ({
        utxoId: input.utxoId,
        owner: input.owner
      })),
      outputs: transaction.outputs,
      timestamp: transaction.timestamp
    };

    return JSON.stringify(unsignedTx);
  }
}
